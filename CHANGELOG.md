# Changelog

## Unreleased

### Breaking changes

- **String keys are stored as-is.** `useUpstream("theme")` used to be stored under `"theme"`
  (with quotes), so `store.set("theme", …)` didn't reach the hook. Values persisted by
  `useUpstreamPersistent` under the old quoted keys won't be found anymore.
- **`onSuccess` and `onError` return values are ignored.** They used to replace the data/error.
  Use the new `transform` option to change fetched data.
- **`refetchWhenStale` defaults to `false`.** Every hook with a fetcher used to refetch every 30s.
- **`fetchTimeout` aborts the request** and fails it with a `TimeoutError`, as documented.
  `onLoadingSlow` is now driven by `loadingSlowTimeout` (defaults to `fetchTimeout`).
- **`refetchOnFocus` and `refetchOnReconnect` default to `true`**, as documented (they behaved as `false`).
- **Fetchers receive a second argument**, `{ signal }`.
- `react` is a peer dependency only (`^18 || ^19`), no longer a dependency.
- Node.js 20 or later is required for development.

### Tooling

- All dev dependencies updated to their latest versions: TypeScript 7, ESLint 10, bunchee 7, Jest 30.5,
  React 19.3, jest-dom 7, msw 3.
- TypeScript 7 ships without a compiler API yet, so `typescript` is aliased to
  `@typescript/typescript6` for tools that need one (ts-jest, typescript-eslint, bunchee's type
  bundling), while `tsc` (type checking) runs TypeScript 7 from `@typescript/native`.
- Tests use `tsconfig.test.json`, since TypeScript 6+ no longer loads `@types/*` packages by default.
- `pnpm typecheck` also checks the tests, including type-level tests in `test/types.check.tsx`.

### Added

- Documentation in [`docs/`](./docs/README.md), with its examples run as tests.
- `initialValues` store option, to seed a store with plain data (e.g. passed from a server component).

- Lookup parents: `createStore({ parents: [a, b] })` reads missing keys from other stores without
  joining their hierarchy or writing to them. Controlled by `lookupParents` and `syncWithParents`.
- `mutate(key, data, options)` and `revalidate(key)` to update or refetch keys outside React,
  with `optimisticData` and automatic rollback.
- `initialValue` config option, as an unambiguous alternative to the positional argument.
- `transform` config option.
- `AbortSignal` passed to fetchers, aborted on timeout or when superseded by a newer request.
- `prefix` option for `createStoreFromStorage`; values that can't be persisted (quota exceeded)
  are kept in memory.
- `store.observe(cb)` to observe every change in a store; `store.attach()`, `detach()`, `dispose()`.
- `useStore` detaches its store on unmount (`autoDispose`, previously documented but not implemented).
- Development warning when the global store is written on the server.
- Named `useUpstream` export; `BaseStore` export.

### Fixed

- `"use client"` marked the store and utility modules instead of every React module: hooks such as
  `useStore` were bundled without it, pulling React hook imports into the server graph of React Server
  Components. Only React modules (hooks, `UpstreamProvider`) are client modules now.
- `useUpstream(key, fetcher)` inferred the fetcher's function type instead of its data with TypeScript 6+.
- Dependent keys returning `undefined` (`() => user && [...]`) were rejected by the `Key` type.
- Type declarations: separate `.d.ts` / `.d.cts` files for `import` and `require`.

- Fetchers passed through config or `UpstreamProvider` never ran.
- `useUpstreamRoot` (and any `hookMiddleware` hook with a function config) broke the rules of hooks.
- Deleting a key didn't re-render components.
- Child stores went stale after their first read of a parent value.
- Error retries were deduplicated away, nested, and left the error set after a successful retry.
- Deduplicated hooks stayed in `isFetching` forever.
- Background refetch timers accumulated over time.
- Distinct non-plain objects (e.g. `Map`) used as keys collided.
- Every store leaked window listeners, and storage events from other tabs were written into every store.
- Only one store was notified on reconnect.
- Changing the key kept showing the previous key's value; consecutive functional updates were lost.
- `{ store: undefined }` overrode the provider's store; an initial value prevented the first fetch.
- Self-parenting and cycles weren't detected; re-parenting duplicated children.
- Blocking a wave also blocked sibling subtrees.
- `clone()` dropped the config; deserializing ignored the serialized config.
- Storage stores ignored `name` and crashed on non-JSON values.
- `useUpstreamPersistent` reported `fromPersistentStore: false` and read the global store on the server.
- A diverged store deleting its override notified `undefined` instead of the revealed parent value.
