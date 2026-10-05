# Providers

`UpstreamProvider` gives every `useUpstream` call below it a default config: which store to use, which
fetcher, retry settings, and so on.

```tsx
import { UpstreamProvider, createStore } from "upstream-react";

const appStore = createStore({ name: "App" });

function Root() {
  return (
    <UpstreamProvider config={{ store: appStore, fetcher: fetchJson, errorRetries: 2 }}>
      <App />
    </UpstreamProvider>
  );
}
```

Inside `App`, `useUpstream("/api/me")` reads from `appStore`, fetches with `fetchJson`, and retries
twice on errors.

Providers are optional. Without one, hooks use the global store and the default options.

## Merging

Configs merge from the outside in: a provider's config is merged over its parent provider's, and the
hook's own config is merged over the nearest provider's.

```tsx
<UpstreamProvider config={{ fetcher: fetchJson, errorRetries: 2 }}>
  <UpstreamProvider config={{ errorRetries: 5 }}>
    {/* fetcher: fetchJson, errorRetries: 5 */}
    <Feed />
  </UpstreamProvider>
</UpstreamProvider>

// In Feed: errorRetries 0 for this hook only
useUpstream("/api/feed", { errorRetries: 0 });
```

Options set to `undefined` don't override anything, so `{ store: someCondition ? myStore : undefined }`
falls back to the provider's store.

`initialValue` is never inherited from a provider, since it only makes sense for a specific key.

### Computing a config from the parent's

Pass a function to derive the config from the parent provider's:

```tsx
<UpstreamProvider config={parent => ({ errorRetries: (parent?.errorRetries ?? 0) + 1 })}>
```

## Scoping state

The most common use of a provider is giving part of the tree its own store:

```tsx
function Modal({ children }: { children: React.ReactNode }) {
  const store = useStore({ name: "Modal" });
  return <UpstreamProvider config={{ store }}>{children}</UpstreamProvider>;
}
```

Hooks inside the modal now read and write the modal's store. Since that store is a child of the outer
store (see below), app-wide keys are still visible and kept in sync. To keep the modal's writes local,
diverge it: `useStore({ name: "Modal", syncUp: false })`.

## `useStore`

```tsx
const store = useStore(config?);
```

Creates a store when the component mounts and returns the same store on every render.

- **Parent:** by default, the nearest provider's store (or the global store). Pass `parent` to pick
  another one. When the config has `isolate: true` or `parents`, no parent is assigned automatically.
- **Cleanup:** the store is disposed when the component unmounts, unless `autoDispose: false`.
- **Config changes** after the first render are ignored, since the store already exists.

```tsx
const draft = useStore({ name: "Draft", syncUp: false });                // diverged from the provider's store
const dashboard = useStore({ parents: [globalStore, userStore] });       // lookup parents only
const seeded = useStore({ initialValues: { "/api/me": user } });         // see SSR
```

## `useUpstreamConfig`

Reads the merged config of the nearest provider, optionally merged with your own:

```tsx
import { useUpstreamConfig } from "upstream-react";

function DebugPanel() {
  const { store } = useUpstreamConfig();
  return <pre>{store?.serialize()}</pre>;
}
```

## `useUpstreamRoot`

Same as `useUpstream`, but always uses the root of the current store's hierarchy, for values that must
be shared app-wide no matter how deeply nested the component is:

```tsx
import { useUpstreamRoot } from "upstream-react";

const [notifications, setNotifications] = useUpstreamRoot("notifications", []);
```

The root is found by following `parent` links (lookup `parents` are ignored).
