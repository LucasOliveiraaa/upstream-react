# Stores

A store holds key-value pairs and notifies subscribers when they change. Hooks read and write stores,
but you can use them directly too, from any code.

## Creating a store

```ts
import { createStore } from "upstream-react";

const cartStore = createStore({ name: "Cart" });
```

`createStore` accepts all the options of [`StoreConfig`](./api-reference.md#store-options), plus:

| Option | Description |
| --- | --- |
| `name` | A display name, used in warnings and handy when debugging |
| `parent` | The store's parent in a hierarchy, see [synchronization](./synchronization.md) |
| `parents` | Read-only lookup parents, see [lookup parents](./synchronization.md#lookup-parents) |
| `provider` | Where values are kept (default: a `Map`), see [custom providers](#custom-providers) |
| `initialValues` | Values to start with, as `{ key: value }`. Only written to this store, never to its parents |
| `initialState` | A string from `store.serialize()` to restore, see [SSR](./ssr.md) |

Inside components, prefer [`useStore`](./providers.md#usestore), which creates the store once and
cleans it up on unmount.

## The global store

```ts
import { globalStore } from "upstream-react";
```

The store used by hooks when no other store is given. It's created by the library and lives as long as
the page. Don't write to it on a server, see [SSR](./ssr.md).

## Reading and writing

```ts
cartStore.set("items", ["apple"]);
cartStore.get("items");     // ["apple"]
cartStore.has("items");     // true: this store has its own value
cartStore.delete("items");
```

`get` also returns values the store inherits from its parents, while `has` only reports values the
store holds itself.

Keys used by hooks are plain strings for string keys, so `cartStore.set("items", ...)` and
`useUpstream("items", { store: cartStore })` share the same value. Array and object keys are
serialized; use [`mutate`](./mutations.md) to write them from outside components.

`set` returns the previous value. `setAndDontNotify` writes without notifying anyone, which is rarely
what you want: components won't re-render until something else changes.

## Subscribing

```ts
// One key
const unsubscribe = cartStore.subscribe("items", (value, prev) => {
  console.log("items changed from", prev, "to", value);
});

// Every key
const stop = cartStore.observe((key, value, prev) => {
  analytics.track("state_change", { key });
});

// Or at creation
const store = createStore({
  onChange: (key, value, prev) => console.log(key, prev, "→", value),
});
```

Subscribers are notified of every change of the value the store **exposes**, including changes
inherited from parent stores (see [synchronization](./synchronization.md)).

## Cloning

```ts
const copy = cartStore.clone();
```

Copies the store's own values (deeply, for plain objects and arrays), its config and its parents. The
copy is independent: changing one doesn't change the other.

## Serializing

```ts
const snapshot = cartStore.serialize(); // JSON string
const restored = createStore({ initialState: snapshot });
```

Serializes the store's own values, name and config (functions like `onChange` are dropped). Values
must be JSON-serializable.

## Disposing

```ts
store.dispose();
```

Detaches the store from its parents and removes its listeners, so it can be garbage collected. Call it
when you're done with a store created by `createStore` that has parents. Stores created with
[`useStore`](./providers.md#usestore) are disposed automatically on unmount.

`store.attach()` reconnects a disposed store.

## Custom providers

A provider is the storage behind a store. It's any object with `get`, `set`, `delete` and `keys`
methods; a `Map` works:

```ts
const store = createStore({ provider: new Map() });
```

For Web Storage (`localStorage`, `sessionStorage`), use
[`createStoreFromStorage`](./persistence.md#any-web-storage), which handles serialization and
cross-tab sync.
