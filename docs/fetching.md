# Fetching data

## Fetchers

A fetcher is a function receiving the key and an options object with an `AbortSignal`, and returning
the data (or a promise of it):

```ts
const fetchJson = async (url: string, { signal }: { signal?: AbortSignal }) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};
```

The key is passed as you wrote it, not serialized, so array keys are convenient for parameters:

```tsx
const fetchUser = ([, id]: [string, number]) => api.getUser(id);
const [user] = useUpstream(["/api/users", id], fetchUser);
```

A fetcher can be given as the second argument, in the config (`{ fetcher }`), or for a whole subtree
through a [provider](./providers.md):

```tsx
<UpstreamProvider config={{ fetcher: fetchJson }}>
  <App /> {/* useUpstream("/api/me") fetches with fetchJson */}
</UpstreamProvider>
```

## When does it fetch?

| Trigger | Default | Option |
| --- | --- | --- |
| On mount, when the key has no value yet | always | `refetchOnMount: true` to also fetch when it has one |
| When the key changes, and the new key has no value | always | |
| When the window regains focus or the page becomes visible | on | `refetchOnFocus` |
| When the network reconnects | on | `refetchOnReconnect` |
| Every N milliseconds | off | `refetchInterval` |
| N milliseconds after each successful fetch | off | `refetchWhenStale` + `staleTimeSpan` (default 30s) |
| Manually | | `meta.refetch()`, [`revalidate(key)`](./mutations.md) |

An initial value doesn't count as data: with both an initial value and a fetcher, the initial value is
shown until the fetch completes.

Interval and stale refetches are skipped while the page is hidden or offline. Pass
`refetchWhenHidden: true` or `refetchWhenOffline: true` to change that.

## Loading and error states

```tsx
const [user, , { isInitial, isFetching, error, refetch }] = useUpstream("/api/me", fetchJson);

if (isInitial) return <Spinner />;            // nothing to show yet
if (error && !user) return <Retry onClick={refetch} />;
return <Profile user={user} refreshing={isFetching} />;
```

- `isFetching` is `true` whenever a request is running, including background refreshes.
- `isInitial` is `true` until the first data or error arrives, which is usually what a loading
  screen wants.
- `error` holds the last error. It's kept when a later fetch fails and cleared when one succeeds. The
  previous data stays available, so you can show stale data with an error message.

## Deduplication

Hooks sharing a key share requests. When a fetch starts while another one for the same key is running,
it waits for the running one instead of calling the fetcher again, as long as the running request
started less than `dedupeTimeSpan` milliseconds ago (default 2000).

When the running request is older than that, a new request starts and the old one is **aborted**, so a
slow old response can never overwrite newer data.

## Retries

```tsx
useUpstream("/api/feed", fetchJson, {
  errorRetries: 3,          // retry up to 3 times (default 0)
  errorRetryInterval: 1000, // wait 1s between attempts (default 2000)
  onErrorRetry: (error, key) => console.warn(`Retrying ${key}`, error),
  onError: (error, key) => toast.error(`Couldn't load ${key}`),
});
```

`onError` is called once, after the last attempt failed.

## Timeouts and cancellation

```tsx
useUpstream("/api/report", fetchJson, {
  fetchTimeout: 10_000,       // abort after 10s
  loadingSlowTimeout: 3_000,  // but tell the user after 3s
  onLoadingSlow: () => toast("This is taking a while..."),
});
```

When a request exceeds `fetchTimeout`, the fetcher's `signal` is aborted and the request fails with an
error named `TimeoutError`. Retries apply to timeouts like to any other error.

The request fails on timeout even if your fetcher ignores the signal, but passing the signal to
`fetch` (or your HTTP client) also cancels the underlying network request.

The signal is also aborted when a newer request for the same key supersedes the request (see
[Deduplication](#deduplication)). Unmounting a component doesn't abort its request: the result is
still cached for the next component that needs it.

## Transforming data

`transform` changes the fetched data before it's stored:

```tsx
const [names] = useUpstream("/api/users", fetchJson, {
  transform: (users: User[]) => users.map(user => user.name),
});
// names: string[] | undefined
```

`onSuccess` is called afterwards with the stored data. Its return value is ignored.

## Polling

```tsx
const [stats] = useUpstream("/api/stats", fetchJson, { refetchInterval: 5000 });
```

The next request is scheduled when the previous one ends, so slow responses never pile up.

## Conditional and dependent fetching

Use a [disabled key](./core-concepts.md#disabling-a-key) to wait:

```tsx
const [user] = useUpstream("/api/me", fetchJson);
const [projects] = useUpstream(() => user && `/api/users/${user.id}/projects`, fetchJson);
```
