# Custom hooks

## Wrapping `useUpstream`

The simplest custom hooks are plain functions calling `useUpstream`:

```tsx
export function useCurrentUser() {
  const [user, setUser, meta] = useUpstream<User>("/api/me", fetchJson, { errorRetries: 2 });
  return { user, setUser, ...meta };
}
```

## `hookMiddleware`

`hookMiddleware` creates a hook with the same signatures as `useUpstream`, but with some options
forced:

```ts
import { hookMiddleware } from "upstream-react";

export const useApi = hookMiddleware({
  fetcher: fetchJson,
  errorRetries: 3,
  fetchTimeout: 10_000,
});

// Used exactly like useUpstream
const [user] = useApi<User>("/api/me");
const [posts] = useApi<Post[]>(["/api/posts", { page }]);
```

The middleware's options take precedence over the options passed by the caller.

`useUpstreamPersistent` is built this way: `hookMiddleware({ store: persistentStore })`.

### Computing options

Pass a function to compute the options on every call. It receives the caller's config and may call
other hooks (always the same ones, in the same order, like any hook):

```ts
export const useTenantData = hookMiddleware(callerConfig => {
  const tenant = useTenant();   // your own hook
  return { store: tenant.store };
});
```

`useUpstreamRoot` is built this way too: it reads the provider's store with `useUpstreamConfig` and
returns the root of its hierarchy.
