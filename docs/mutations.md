# Mutations

## From components

The setter returned by `useUpstream` covers most cases:

```tsx
const [todos, setTodos] = useUpstream<Todo[]>("todos", []);

setTodos(todos => [...(todos ?? []), newTodo]);
```

## From anywhere: `mutate`

`mutate` updates a key from outside React: event handlers in plain modules, websocket listeners, API
helpers, tests...

```ts
import { mutate } from "upstream-react";

mutate("theme", "dark");                         // a value
mutate<number>("count", n => (n ?? 0) + 1);      // an updater, from the latest value
mutate("token", undefined);                      // delete
```

It accepts the same keys as `useUpstream`, including arrays and objects:

```ts
mutate(["/api/users", 42], updatedUser);
```

It returns a promise of the new value. Pass `{ store }` to target a store other than the global one:

```ts
await mutate("draft", "", { store: editorStore });
```

## Optimistic updates

Pass a promise to wait for a server response, and `optimisticData` to show the expected result in the
meantime:

```ts
async function rename(user: User, name: string) {
  await mutate("/api/me", api.updateUser({ ...user, name }), {
    optimisticData: { ...user, name },
  });
}
```

1. `optimisticData` is shown immediately.
2. When the promise resolves, its value replaces the optimistic data.
3. When it rejects, the previous value is restored and the error is rethrown. Pass
   `rollbackOnError: false` to keep the optimistic data instead.

When the request doesn't return the updated entity, return it yourself:

```ts
await mutate("/api/me", api.updateUser(changes).then(() => ({ ...user, ...changes })), {
  optimisticData: { ...user, ...changes },
});
```

## Revalidating

Revalidating asks every mounted hook with a fetcher for that key to fetch it again:

```ts
import { mutate, revalidate } from "upstream-react";

revalidate("/api/me");                                   // just refetch
mutate("/api/me");                                       // same thing
await mutate("/api/me", updatedUser, { revalidate: true }); // update, then refetch
```

Revalidation only reaches mounted hooks, since only they know the fetcher. When nothing is mounted for
the key, it does nothing; the next component to mount fetches only if the key has no value.
