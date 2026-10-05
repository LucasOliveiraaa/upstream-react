# The `useUpstream` hook

```tsx
import useUpstream from "upstream-react";
// or: import { useUpstream } from "upstream-react";
```

## Signatures

```ts
useUpstream(key)
useUpstream(key, config)
useUpstream(key, initialValue)
useUpstream(key, initialValue, config)
useUpstream(key, fetcher)
useUpstream(key, fetcher, config)
```

The second argument is interpreted by its type:

- a **function** is a fetcher,
- an **object with at least one config option** (`store`, `fetcher`, `onError`, ...) is a config,
- **anything else** is an initial value.

When your initial value is a function or an object that looks like a config, use the `initialValue`
option so it can't be misread:

```tsx
const [onSave] = useUpstream("onSave", { initialValue: () => console.log("saved") });
const [filters] = useUpstream("filters", { initialValue: { store: "all" } });
```

## Reading

```tsx
const [theme] = useUpstream<string>("theme");
```

The component re-renders whenever the key changes in the store, whoever changed it: another
component, a [`mutate`](./mutations.md) call, a parent store, or another browser tab for
[persistent stores](./persistence.md).

## Initial values

```tsx
const [items, setItems] = useUpstream<string[]>("cart", []);
```

When the key has no value in the store, the initial value is shown immediately and written to the
store after the first render, so every other component reading the key sees it too.

When the key already has a value, the initial value is ignored. If several components pass different
initial values, the first one to mount wins.

## Writing

The setter accepts a value, or an updater receiving the latest value:

```tsx
setCount(5);
setCount(n => (n ?? 0) + 1);
```

Updaters always receive the latest value in the store, so several updates in a row compose:

```tsx
setCount(n => (n ?? 0) + 1);
setCount(n => (n ?? 0) + 1); // count is now 2 higher
```

The setter's identity is stable for a given key and store, so it's safe in dependency arrays.

## Deleting

Set `undefined` (or call the setter without arguments) to delete the key:

```tsx
setToken(undefined);
setToken();
```

Components reading the key now get `undefined`, the initial value isn't restored.

## Choosing a store

Values go to the global store unless you pick another one, either per hook or for a whole subtree with
a [provider](./providers.md):

```tsx
const [draft, setDraft] = useUpstream("draft", "", { store: editorStore });
```

## Changing keys

The key can change between renders. The hook then reads the new key, and fetches it if it has a
fetcher and no value yet:

```tsx
function User({ id }: { id: number }) {
  const [user] = useUpstream(["/api/users", id], fetchUser);
  // ...
}
```

## Using it with TypeScript

The value type is inferred from the initial value or the fetcher, or can be given explicitly. The
second type parameter is the error type:

```tsx
const [count] = useUpstream("count", 0);                // number | undefined
const [user] = useUpstream("/api/me", fetchUser);       // User | undefined
const [cart] = useUpstream<Item[]>("cart");             // Item[] | undefined
const [, , { error }] = useUpstream<User, ApiError>("/api/me", fetchUser);
```

The value is always possibly `undefined`, since a key may be deleted or not fetched yet.
