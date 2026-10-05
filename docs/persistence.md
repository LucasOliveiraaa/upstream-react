# Persistence

## `useUpstreamPersistent`

Same as `useUpstream`, but values are stored in `localStorage`, so they survive reloads:

```tsx
import { useUpstreamPersistent } from "upstream-react";

function ThemeToggle() {
  const [theme, setTheme] = useUpstreamPersistent("theme", "light");
  // ...
}
```

- Values are stored as JSON under the key itself (`localStorage.getItem("theme")` returns `"\"light\""`).
  They must be JSON-serializable.
- Changes made in other tabs are picked up immediately, and components re-render.
- Existing entries that aren't JSON (written by other code) are returned as plain strings.
- When a value can't be saved (storage full, or blocked by the browser), it's kept in memory for the
  session and a warning is logged.

The store behind it is exported as `persistentStore`. It's [isolated](./synchronization.md#controlling-the-flow):
it has no parent and no children, so persisted values never mix with the rest of your state. Other
stores can still read from it as a [lookup parent](./synchronization.md#lookup-parents):

```ts
import { createStore, persistentStore } from "upstream-react";

const settingsStore = createStore({ parents: [persistentStore] }); // reads persisted preferences
```

On the server, where `localStorage` doesn't exist, `persistentStore` is an empty in-memory store. See
[hydration](#hydration).

## Any Web Storage

`createStoreFromStorage` creates a store backed by any `Storage` object, such as `sessionStorage`:

```ts
import { createStoreFromStorage } from "upstream-react";

const sessionStore = createStoreFromStorage(sessionStorage, {
  name: "Session",
  prefix: "my-app:",  // keys are stored as "my-app:<key>"
  persistent: true,   // reported by meta.fromPersistentStore, see hydration
});

const [step, setStep] = useUpstream("wizard-step", 1, { store: sessionStore });
```

A `prefix` keeps your entries apart from other code using the same storage: the store only lists,
serializes and syncs keys with its prefix.

It accepts the other [store options](./api-reference.md#store-options) too (`parent`, `parents`, ...).
Call `store.dispose()` when you're done with it, to stop listening to other tabs.

## Hydration

Persisted values only exist in the browser. During server rendering, hooks bound to a store marked
`persistent` render their initial value; in the browser, the first render during hydration does the
same so the markup matches the server's, then the persisted value is shown.

`meta.fromPersistentStore` tells you when a hook's store (or one of its parents) is persistent, for
example to avoid a flash of the default theme with a placeholder.
