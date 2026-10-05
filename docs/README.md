# upstream-react documentation

`upstream-react` is a small state management and data fetching library for React. You read and write
shared state with a single hook, `useUpstream`, and organize that state in **stores** that can be
arranged in hierarchies and kept in sync with each other.

```tsx
import useUpstream from "upstream-react";

function Counter() {
  const [count, setCount] = useUpstream("count", 0);
  return <button onClick={() => setCount(n => n + 1)}>Clicked {count} times</button>;
}
```

Every component calling `useUpstream("count")` shares the same value and re-renders when it changes.

## Guides

Read these in order if you're new to the library.

1. [Getting started](./getting-started.md): installation, requirements, your first shared state
2. [Core concepts](./core-concepts.md): keys, values, stores, and how they fit together
3. [The `useUpstream` hook](./use-upstream.md): reading, writing, initial values, deleting
4. [Fetching data](./fetching.md): fetchers, loading and error states, retries, revalidation
5. [Stores](./stores.md): creating stores and using them outside React
6. [Store synchronization](./synchronization.md): hierarchies, diverging, lookup parents, waves
7. [Providers](./providers.md): scoping stores and defaults to a part of the tree
8. [Mutations](./mutations.md): updating state from anywhere, optimistic updates
9. [Persistence](./persistence.md): `localStorage`, other storages, cross-tab sync
10. [Server-side rendering](./ssr.md): Next.js, Remix, and hydration
11. [Custom hooks](./custom-hooks.md): building your own hooks on top of `useUpstream`

## Reference

- [API reference](./api-reference.md): every export, option and default
- [Migrating from 0.6](./migration.md): breaking changes in the next release
