# Core concepts

## Keys

Every value is identified by a key. A key can be:

| Key | Example | Stored as |
| --- | --- | --- |
| A string | `"theme"`, `"/api/me"` | The string itself |
| An array | `["/api/user", id]` | Serialized by content |
| A plain object | `{ page: 2, sort: "name" }` | Serialized by content (property order doesn't matter) |
| Any other object | a `Map`, a class instance | By identity: the same instance is the same key |
| A function | `() => user && ["/api/posts", user.id]` | The value it returns, evaluated on every render |

Arrays and objects are compared by content, so you can write them inline: `["/api/user", 1]` in two
components is the same key, even though they're two different arrays.

### Disabling a key

`null`, `false`, `""` and `[]` are **disabled** keys: the hook returns `undefined`, never fetches, and
its setter does nothing. Combined with function keys, this makes dependent data easy:

```tsx
const [user] = useUpstream("/api/me", fetchJson);
// Waits for the user before fetching their posts
const [posts] = useUpstream(() => user && ["/api/posts", user.id], fetchPosts);
```

A function key that throws is disabled too, so `() => ["/api/posts", user.id]` works even while `user`
is `undefined`.

## Values

A value is anything except `undefined`. Writing `undefined` **deletes** the key.

Changes are detected with `Object.is`, like React's `useState`. Always replace objects and arrays
instead of mutating them, otherwise components won't re-render:

```tsx
// ✗ Same array, nothing happens
setTodos(todos => { todos.push(todo); return todos; });

// ✓ New array
setTodos(todos => [...(todos ?? []), todo]);
```

## Stores

A store is a key-value container. Components subscribe to keys of a store and re-render when they
change.

- The **global store** is used when you don't specify one. It's created by the library.
- You can create your own with [`createStore`](./stores.md), and give one to a part of your app with
  an [`UpstreamProvider`](./providers.md).
- Stores can be connected, so a store can read values from other stores and stay in sync with them.
  See [Store synchronization](./synchronization.md).

```tsx
import useUpstream, { createStore } from "upstream-react";

const settingsStore = createStore({ name: "Settings" });

function Volume() {
  const [volume, setVolume] = useUpstream("volume", 50, { store: settingsStore });
  // ...
}
```

## The hook's return value

`useUpstream` returns a tuple, so you can name the parts however you like:

```tsx
const [value, setValue, meta] = useUpstream("key");
```

| Part | Description |
| --- | --- |
| `value` | The current value, or `undefined` |
| `setValue` | Sets a new value, an updater function, or `undefined` to delete |
| `meta.isFetching` | `true` while the fetcher is running |
| `meta.isInitial` | `true` until the first value or error arrives (only with a fetcher) |
| `meta.error` | The last fetch error, cleared by the next successful fetch |
| `meta.refetch` | Runs the fetcher again, returns a promise of the new value |
| `meta.fromPersistentStore` | `true` when the store (or one of its parents) is persistent |
