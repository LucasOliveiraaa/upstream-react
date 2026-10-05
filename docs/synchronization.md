# Store synchronization

Stores can be connected in two ways:

- **Hierarchies** (`parent`): a child reads what it doesn't have from its parent, writes go up to the
  parent, and changes in the parent flow down to the children.
- **Lookup parents** (`parents`): a store reads what it doesn't have from a list of other stores, but
  never writes to them.

## Hierarchies

```ts
import { createStore } from "upstream-react";

const app = createStore({ name: "App" });
const page = createStore({ name: "Page", parent: app });
```

By default, a child is a **mirror** of its parent:

```ts
app.set("theme", "dark");
page.get("theme");        // "dark": read from the parent

page.set("theme", "light");
app.get("theme");         // "light": written up to the parent

app.set("theme", "blue");
page.get("theme");        // "blue": pushed down to the child
```

Components bound to `page` re-render when `theme` changes in `app`, and the other way around.

Hierarchies can be as deep as you need. A write goes all the way up and comes back down to every store
in the tree.

### Controlling the flow

Four options control how values move between a store and its parent:

| Option | Set on | Default | When `false` |
| --- | --- | --- | --- |
| `syncUp` | the child | `true` | The child's writes stay in the child |
| `stayInSync` | the child | `true` | The child doesn't read from its parent (and doesn't receive its changes) |
| `syncDown` | the parent | `true` | No child reads from this store (or receives its changes) |
| `isolate` | either | `false` | The store can't have a parent or children at all |

```text
                 reads (stayInSync on child, syncDown on parent)
   ┌────────┐  ─────────────────────────────────────────────▶  ┌───────┐
   │ parent │                                                   │ child │
   └────────┘  ◀─────────────────────────────────────────────  └───────┘
                 writes (syncUp on child)
```

### Diverging

A child with `syncUp: false` is **diverged**: it reads from its parent but its writes stay local,
overriding the parent's value for that key only.

```ts
const base = createStore({ name: "Base" });
const preview = base.diverge({ name: "Preview" }); // same as createStore({ parent: base, syncUp: false })

base.set("color", "red");
base.set("size", "M");

preview.set("color", "blue");   // a local override
preview.get("color");           // "blue"
base.get("color");              // "red": the parent is untouched

base.set("size", "L");
preview.get("size");            // "L": keys without an override still follow the parent

base.set("color", "green");
preview.get("color");           // "blue": the override wins

preview.delete("color");
preview.get("color");           // "green": deleting the override reveals the parent's value
```

Deleting a key a diverged store only inherits does nothing, since the value belongs to the parent.

This is useful for previews, drafts, "what if" scenarios, or tests that must not touch shared state.

### A typical layout

```tsx
// App-wide state lives in the global store.
// Each open document gets a child store: document state stays scoped,
// but app-wide keys are still readable and writable from inside it.
function Document({ id }: { id: string }) {
  const store = useStore({ name: `Document ${id}` }); // parent: the provider's store
  return (
    <UpstreamProvider config={{ store }}>
      <Editor />
    </UpstreamProvider>
  );
}
```

## Lookup parents

Sometimes a store needs values from several stores without belonging to their hierarchy. Take a
dashboard whose state needs app-wide settings from the global store and the user's profile from a user
store, but must never write to either:

```ts
import { createStore, globalStore } from "upstream-react";

const userStore = createStore({ name: "User" });

const dashboardStore = createStore({
  name: "Dashboard",
  parents: [globalStore, userStore], // searched in order
});

globalStore.set("locale", "en");
userStore.set("name", "Ada");

dashboardStore.get("locale");        // "en"
dashboardStore.get("name");          // "Ada"

dashboardStore.set("role", "admin");
userStore.get("role");               // undefined: lookup parents are never written to

dashboardStore.set("name", "Ada (admin)");
dashboardStore.get("name");          // "Ada (admin)": a local value hides the parents' one
userStore.get("name");               // "Ada"
```

Lookup parents are read-only sources:

- the store never writes to them,
- the store doesn't become their child: no values pushed down, no [waves](#waves),
- a store can be a lookup parent of many stores, and have many lookup parents,
- isolated stores can be lookup parents, and have them (the persistent store is isolated, for example).

### Lookup order

When a key is read, the first store with a value wins:

1. the store itself,
2. its `parent` (and the parent's own parents, recursively), when it has one,
3. each of its `parents`, in order.

```ts
const store = createStore({ parent: app, parents: [defaults, fallbacks] });
// store → app → defaults → fallbacks
```

### Live or snapshot

| Option | Default | Effect |
| --- | --- | --- |
| `lookupParents` | `true` | Search `parents` for missing keys. When `false`, `parents` are ignored. |
| `syncWithParents` | `true` | Keep looked-up values live. |

With `syncWithParents: true`, components re-render when a looked-up value changes in its parent (as
long as nothing with a higher priority hides it).

With `syncWithParents: false`, a value is copied into the store the first time it's read. Later changes
in the parent are ignored, which is useful to start from shared defaults and then evolve on your own:

```ts
const formStore = createStore({ parents: [profileStore], syncWithParents: false });

formStore.get("email");              // copied from profileStore
profileStore.set("email", "new@example.com");
formStore.get("email");              // still the original value
```

### In components

[`useStore`](./providers.md#usestore) creates a store for the lifetime of a component. With `parents`,
it doesn't attach the store to the surrounding provider's store, so the store only reads from what you
gave it:

```tsx
function Dashboard() {
  const store = useStore({ name: "Dashboard", parents: [globalStore, userStore] });

  return (
    <UpstreamProvider config={{ store }}>
      <RolePicker />  {/* useUpstream("name") reads from userStore, live */}
    </UpstreamProvider>
  );
}
```

### Cycles

A store can't be its own ancestor through any mix of `parent` and `parents`. Such a parent is rejected
with a console warning.

## Waves

Waves are messages sent from a store to all of its descendants in the hierarchy (not to the store
itself, and not through lookup parents):

```ts
const unobserve = childStore.observeWave(wave => {
  if (wave.type === "logout") childStore.delete("draft");
});

app.wave("logout", { reason: "expired" });
```

A wave has a `type`, a `payload`, and the `source` store. An observer can stop the wave from reaching
the descendants of its store:

```ts
sandboxStore.observeWave(wave => {
  wave.blockWave = true; // sandboxStore receives it, its children don't
});
```

Blocking only affects that branch: sibling stores and their children still receive the wave.
