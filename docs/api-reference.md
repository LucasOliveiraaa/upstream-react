# API reference

```ts
import useUpstream, {
  // Hooks
  useUpstream, useUpstreamPersistent, useUpstreamRoot, useStore, useUpstreamConfig, hookMiddleware,
  // Components
  UpstreamProvider,
  // Stores
  createStore, divergeStore, createStoreFromStorage, globalStore, persistentStore, BaseStore,
  // Mutations
  mutate, revalidate,
  // Enums
  EventTypes,
} from "upstream-react";
```

## Hooks

### `useUpstream(key, initialValue | fetcher?, config?)`

Reads and writes a key. See [the hook guide](./use-upstream.md).

Returns `[value, setValue, meta]`:

| | Type | Description |
| --- | --- | --- |
| `value` | `T \| undefined` | The current value |
| `setValue` | `(value?: T \| ((prev: T \| undefined) => T \| undefined)) => void` | Sets the value; `undefined` deletes it |
| `meta.error` | `E \| undefined` | The last fetch error |
| `meta.isInitial` | `boolean` | `true` until the first data or error arrives (only with a fetcher) |
| `meta.isFetching` | `boolean` | `true` while a request is running |
| `meta.refetch` | `() => Promise<T \| undefined>` | Runs the fetcher |
| `meta.fromPersistentStore` | `boolean` | The store or one of its parents is `persistent` |

### `useUpstreamPersistent(...)`

Same as `useUpstream`, bound to `persistentStore` (`localStorage`). See [persistence](./persistence.md).

### `useUpstreamRoot(...)`

Same as `useUpstream`, bound to the root of the current store's `parent` chain.

### `useStore(config?)`

Creates a store once per component and disposes it on unmount. Accepts the
[`createStore` options](#createstoreconfig). See [providers](./providers.md#usestore).

### `useUpstreamConfig(config?)`

Returns the nearest provider's config merged with `config`.

### `hookMiddleware(config | (callerConfig) => config)`

Creates a hook with `useUpstream`'s signatures and some options forced. See
[custom hooks](./custom-hooks.md).

## Hook options

Pass them to `useUpstream` (and the other hooks), or to an `UpstreamProvider` for a subtree.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `store` | `Store` | provider's store, else `globalStore` | Where the key lives |
| `initialValue` | `T` | | Initial value (never inherited from a provider) |
| `fetcher` | `(key, { signal }) => T \| Promise<T>` | | Fetches the value |
| `transform` | `(data, key) => T` | | Transforms fetched data before storing it |
| `onSuccess` | `(data: T, key: string) => void` | | After a successful fetch |
| `onError` | `(error: E, key: string) => void` | | After the last attempt failed |
| `errorRetries` | `number` | `0` | Retries after a failed fetch |
| `errorRetryInterval` | `number` (ms) | `2000` | Delay between retries |
| `onErrorRetry` | `(error, key, refetch) => void` | | Before each retry |
| `fetchTimeout` | `number` (ms) | none | Aborts the request, which fails with a `TimeoutError` |
| `loadingSlowTimeout` | `number` (ms) | `fetchTimeout` | When `onLoadingSlow` is called |
| `onLoadingSlow` | `(key: string) => void` | | A request is taking longer than `loadingSlowTimeout` |
| `onWait` | `(key: string) => void` | | A request joined an in-flight request for the same key |
| `dedupeTimeSpan` | `number` (ms) | `2000` | How long an in-flight request is shared |
| `refetchOnMount` | `boolean` | `false` | Also fetch on mount when the key already has a value |
| `refetchOnFocus` | `boolean` | `true` | Fetch when the window regains focus or the page becomes visible |
| `refetchOnReconnect` | `boolean` | `true` | Fetch when the network reconnects |
| `refetchInterval` | `number` (ms) | none | Poll |
| `refetchWhenStale` | `boolean` | `false` | Fetch again `staleTimeSpan` after each success |
| `staleTimeSpan` | `number` (ms) | `30000` | See `refetchWhenStale` |
| `refetchWhenHidden` | `boolean` | `false` | Keep polling and stale refetches while the page is hidden |
| `refetchWhenOffline` | `boolean` | `false` | Keep polling and stale refetches while offline |

Keys passed to callbacks are the serialized keys: the string itself for string keys.

## Components

### `<UpstreamProvider config={config | (parent) => config}>`

Provides hook options to its subtree, merged over the parent provider's. `undefined` values don't
override. See [providers](./providers.md).

## Stores

### `createStore(config?)`

Creates a store. Options:

| Option | Type | Description |
| --- | --- | --- |
| `name` | `string` | Display name |
| `parent` | `Store` | Parent in a hierarchy |
| `parents` | `Store[]` | Read-only lookup parents |
| `provider` | `StoreProvider` | Storage backend (default: `new Map()`) |
| `initialValues` | `Record<string, unknown>` | Initial values, written to this store only |
| `initialState` | `string` | Output of `store.serialize()` to restore |
| ...[store options](#store-options) | | |

### `divergeStore(store, config?)` / `store.diverge(config?)`

Creates a child of `store` with `syncUp: false`. See [diverging](./synchronization.md#diverging).

### `createStoreFromStorage(storage, config?)`

Creates a store backed by a Web `Storage`. Accepts the `createStore` options (except `provider` and
`initialState`), plus `prefix: string` (default `""`). See [persistence](./persistence.md#any-web-storage).

### `globalStore`

The default store. See [stores](./stores.md#the-global-store).

### `persistentStore`

The `localStorage` store used by `useUpstreamPersistent`. Isolated and `persistent`.

### Store options

| Option | Default | Description |
| --- | --- | --- |
| `syncUp` | `true` | Writes go up to the parent |
| `stayInSync` | `true` | Reads fall back to the parent, and the parent's changes are received |
| `syncDown` | `true` | Children may read from this store and receive its changes |
| `isolate` | `false` | No parent, no children (lookup parents are still allowed) |
| `lookupParents` | `true` | Search `parents` for missing keys |
| `syncWithParents` | `true` | Values found in `parents` stay live; when `false`, they're copied on first read |
| `persistent` | `false` | Marks the store as persistent (`fromPersistentStore`, hydration) |
| `autoDispose` | `true` | `useStore` disposes the store on unmount |
| `onChange` | | `(key, value, prev) => void`, called on every change |

See [synchronization](./synchronization.md) for how these combine.

### Store methods

| Method | Description |
| --- | --- |
| `get(key)` | The value, including inherited ones |
| `has(key)` | Whether the store holds its own value for `key` |
| `set(key, value)` | Sets a value, returns the previous one |
| `setAndDontNotify(key, value)` | Sets a value without notifying subscribers |
| `delete(key)` | Deletes a value |
| `subscribe(key, (value, prev) => void)` | Subscribes to a key, returns an unsubscribe function |
| `observe((key, value, prev) => void)` | Subscribes to every key, returns an unsubscribe function |
| `wave(type, payload)` | Sends a wave to the store's descendants |
| `observeWave((wave) => void)` | Receives waves, returns an unsubscribe function |
| `diverge(config?)` | Creates a diverged child |
| `clone()` | Copies the store |
| `serialize()` | Serializes values, name and config to JSON |
| `attach()` / `detach()` | Connects to / disconnects from its parents |
| `dispose()` | Detaches and removes every listener |

| Property | Description |
| --- | --- |
| `name` | Display name |
| `config` | The store options |
| `parent` | The parent store (settable) |
| `parents` | The lookup parents (settable) |
| `UUID` | A unique id |

## Mutations

### `mutate(key, data?, options?)`

Updates a key from anywhere. `data` is a value, an updater, or a promise. Without `data`, revalidates.
Returns a promise of the new value. See [mutations](./mutations.md).

| Option | Default | Description |
| --- | --- | --- |
| `store` | `globalStore` | The store holding the key |
| `optimisticData` | | Shown while `data` resolves |
| `rollbackOnError` | `true` | Restore the previous value when `data` rejects |
| `revalidate` | `false` (`true` without `data`) | Refetch in mounted hooks afterwards |

### `revalidate(key, store?)`

Makes every mounted hook with a fetcher for `key` refetch it.

## TypeScript types

All types are exported: `Store`, `StoreConfig`, `ExtendedStoreConfig`, `StorageStoreConfig`,
`StoreProvider`, `UpstreamConfig`, `UpstreamResponse`, `Fetcher`, `FetcherOptions`, `Key`,
`SetAction`, `SetActionArg`, `MutateOptions`, `Wave`, `WaveObserver`, `StoreObserver`,
`MutationObserver`, `Unsubscriber`, `TransformConfig`, `UpstreamHook`, `MiddlewareHook`, and more.
