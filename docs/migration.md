# Migrating from 0.6

The next release fixes many bugs, and some fixes change behavior. Go through this list when upgrading.

## String keys are stored as-is

`useUpstream("theme")` used to be stored under `"theme"` **with the quotes**. It's now stored under
`theme`, so `store.set("theme", ...)` and `useUpstream("theme")` finally share the same value.

**Action:** values saved by `useUpstreamPersistent` under the old quoted keys won't be found anymore.
To keep them, copy them once at startup:

```ts
for (const key of Object.keys(localStorage)) {
  if (/^".*"$/.test(key)) {
    const newKey = JSON.parse(key);
    if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, localStorage.getItem(key)!);
    localStorage.removeItem(key);
  }
}
```

If your code called `store.get('"theme"')` (with quotes) to read hook values, remove the quotes.

## `onSuccess` and `onError` return values are ignored

They used to replace the fetched data or the error when they returned something.

**Action:** move data changes to the new `transform` option:

```ts
// Before
useUpstream("/api/users", fetcher, { onSuccess: users => users.map(u => u.name) });
// After
useUpstream("/api/users", fetcher, { transform: users => users.map(u => u.name) });
```

## Background refetching is opt-in

`refetchWhenStale` now defaults to `false`. Every hook with a fetcher used to refetch every 30 seconds.

**Action:** add `refetchWhenStale: true` where you relied on it (or set it once on an `UpstreamProvider`).

## Focus and reconnect refetching work

`refetchOnFocus` and `refetchOnReconnect` were documented as on by default, but behaved as off. They're
now on.

**Action:** set them to `false` where the extra requests are unwanted.

## `fetchTimeout` aborts requests

It used to only call `onLoadingSlow`. A request exceeding it now fails with a `TimeoutError`, and the
fetcher's signal is aborted.

**Action:** if you only wanted the "slow" notification, use `loadingSlowTimeout` instead.

## Fetchers receive a second argument

Fetchers are now called with `(key, { signal })`. This only matters if your fetcher has an optional
second parameter of its own.

## Deleting values notifies components

`setValue(undefined)` used to delete the value without re-rendering anyone. Components now update.

## Parent stores push changes down

Child stores used to copy a parent's value on first read and never see later changes. Children now
follow their parent, except for keys a diverged child has overridden. See
[synchronization](./synchronization.md).

## Packaging

- `react` is a peer dependency only (`^18 || ^19`), so your app's copy is always used.
- The package exposes separate type declarations for `import` and `require`.
