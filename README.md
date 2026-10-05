# Upstream

<p align="left">
    <a aria-label="NPM" href="https://www.npmjs.com/package/upstream-react">
        <img alt="" src="https://badgen.net/npm/v/upstream-react">
    </a>
    <a aria-label="License" href="https://github.com/LucasOliveiraaa/upstream-react/blob/main/LICENSE">
        <img alt="" src="https://badgen.net/npm/license/upstream-react">
    </a>
</p>

<br />

## Introduction

`upstream-react` is a lightweight **state management** and **data synchronization** library for React.

With its single hook, `useUpstream`, you get all the tools you need to build real-time, reactive applications. Everything is powered by a **fast**, **stable**, and **minimal** core:

 * **Hierarchical**, **shared** stores
 * **Lightweight**, **fast**, and **performant** architecture
 * **Automatic** component re-renders on key updates
 * Built-in store **synchronization** across contexts
 * **Fetcher integration** for async data handling
 * Integrated fetch **deduplication** system
 * **SSR-ready** by design
 * **Simple, minimal API**
 * **Optimistic updates** for seamless UX
 * Automatic **error retry** for failed fetches
 * **Window event triggers** (focus, reconnect, etc.)
 * Full **TypeScript support**

<br />

## Documentation

The full guide lives in [`docs/`](./docs/README.md): [getting started](./docs/getting-started.md),
[core concepts](./docs/core-concepts.md), [fetching](./docs/fetching.md),
[store synchronization](./docs/synchronization.md), [providers](./docs/providers.md),
[persistence](./docs/persistence.md), [SSR](./docs/ssr.md) and the [API reference](./docs/api-reference.md).

<br />

## Installation

```bash
npm install upstream-react
# or
yarn add upstream-react
# or
pnpm add upstream-react
```

<br />

## Quick Start

Here’s how simple shared state can be with `upstream-react`:

```tsx
import React from "react";
import useUpstream, { createStore, UpstreamProvider } from "upstream-react";

// 1. Create a global store
const store = createStore({ name: "app" });

// 2. Wrap your app
function App() {
  return (
    <UpstreamProvider config={{ store }}>
      <UserProfile />
      <ThemeSwitcher />
    </UpstreamProvider>
  );
}

// 3. Use the shared store anywhere
function ThemeSwitcher() {
  const [theme, setTheme] = useUpstream("theme", "light");
  return (
    <button onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}>
      Switch to {theme === "light" ? "dark" : "light"}
    </button>
  );
}

function UserProfile() {
  const [theme] = useUpstream("theme");
  return <div>Current theme: {theme}</div>;
}
```

When you click the button, both components update instantly.
The state is **shared** via the store, no props, no context boilerplate.

<br />

## Async Data & Fetchers

You can also give `useUpstream` a **fetcher function** instead of a static fallback value.

```tsx
function User() {
  const [user, setUser, meta] = useUpstream("/api/me", async (url) => {
    const res = await fetch(url);
    return res.json();
  });

  if (meta.isFetching) return <p>Loading...</p>;
  if (meta.error) return <p>Error loading user.</p>;

  return (
    <div>
      <h2>{user?.name}</h2>
      <button onClick={() => setUser({ ...user, name: "Anonymous" })}>
        Anonymize
      </button>
    </div>
  );
}
```

The fetcher runs once, caches the result, and refetches when the window regains focus or the network reconnects.
You can call `meta.refetch()` at any time to manually trigger a new fetch.

The fetcher also receives an `AbortSignal`. It's aborted when the request exceeds `fetchTimeout`
or is superseded by a newer request for the same key:

```tsx
const [user] = useUpstream(
  "/api/me",
  (url, { signal }) => fetch(url, { signal }).then(res => res.json()),
  {
    fetchTimeout: 5000,     // abort after 5s, fails with a TimeoutError
    errorRetries: 2,        // then retry twice
    transform: (raw) => ({ ...raw, fullName: `${raw.first} ${raw.last}` }),
    refetchWhenStale: true, // opt-in background refresh every `staleTimeSpan`
  }
);
```

### Options object

When the initial value is a function, or an object that looks like a config, pass it as `initialValue`
so it can't be mistaken for a fetcher or a config:

```tsx
const [onSave] = useUpstream("onSave", { initialValue: () => console.log("saved") });
const [filters] = useUpstream("filters", { initialValue: { store: "all", onError: false } });
```

<br />

## Mutating from anywhere

`mutate` updates a key outside React, e.g. after a request, with optional optimistic updates:

```ts
import { mutate } from "upstream-react";

// Show the new name right away, roll back automatically if the request fails
await mutate("/api/me", api.rename("Ada"), {
  optimisticData: { ...user, name: "Ada" },
  revalidate: true, // refetch in every mounted hook once done
});

mutate("counter", n => (n ?? 0) + 1); // updater, from the latest value
mutate("/api/me");                    // no data: refetch everywhere
```

Pass `{ store }` to target a store other than the global one.

<br />

## Hierarchical Stores

Stores can **diverge** and inherit values from a parent, allowing scoped overrides that stay in sync.

```tsx
const baseStore = createStore({ name: "base" });
baseStore.set("theme", "light");

const localStore = baseStore.diverge(); // creates a child store

// Still sees "light" from parent
console.log(localStore.get("theme")); // "light"

// Override locally
localStore.set("theme", "dark");
console.log(baseStore.get("theme")); // still "light"
```

Changes made to `baseStore` are pushed down to `localStore` (and any component
reading from it) for every key `localStore` hasn't overridden.

This is perfect for cases like multi-tenant dashboards, isolated testing environments, or dynamic UI overrides that should not affect the global state.

### Multiple (lookup) parents

A store can also read from several other stores without being part of their hierarchy.
Imagine a dashboard whose store needs app-wide settings from the global store and the user's
profile from a user store, but must never write back to either of them:

```tsx
import { createStore, globalStore } from "upstream-react";

const userStore = createStore({ name: "User" });

const protectedStore = createStore({
  name: "Protected",
  parents: [globalStore, userStore], // searched in order
});

userStore.set("name", "Ada");
protectedStore.get("name");       // "Ada", read from userStore
protectedStore.set("role", "admin");
userStore.get("role");            // undefined: lookup parents are never written to
```

Keys are looked up in the store itself, then its `parent` (if any), then each of its `parents` in order.
Lookup parents are read-only: the store doesn't become their child, doesn't write to them and doesn't
receive their waves. Two options control the lookup:

| Option            | Default | Effect |
| ----------------- | ------- | ------ |
| `lookupParents`   | `true`  | Search `parents` for keys missing from the store. |
| `syncWithParents` | `true`  | Keep looked-up values live: components re-render when they change in a parent. When `false`, a value is copied the first time it's read and later parent changes are ignored. |

Inside components, `useStore({ parents: [...] })` creates such a store without attaching it to the
surrounding provider's store, and detaches it on unmount.

<br />

## Server-Side Rendering (SSR)

`upstream-react` works seamlessly with SSR frameworks like **Next.js** or **Remix**.

> **Don't write to the global store on the server.** On a server it lives as long as the process,
> so it's shared by every request and data can leak between users. Create a store per request and
> pass it through `UpstreamProvider` instead (a warning is logged in development).

 * You can pre-populate the store on the server.
 * On hydration, `useUpstream` will use those values and revalidate if needed.

```tsx
// Example: Next.js page
export async function getServerSideProps() {
  const store = createStore();
  store.set("user", await fetchUser());
  return { props: { initialState: store.serialize() } };
}

function Page({ initialState }) {
  // Create the store once per mount, not on every render
  const store = useStore({ initialState });
  return (
    <UpstreamProvider config={{ store }}>
      <User />
    </UpstreamProvider>
  );
}
```

With the Next.js app router, `createStore` can't be called from a server component: pass the data to a
client component and seed a store there with `useStore({ initialValues })`. See [the SSR guide](./docs/ssr.md).

`useUpstreamPersistent` values come from `localStorage`, which only exists in the browser. During
hydration they render their initial value (matching the server markup), then update.

<br />

## License

MIT © [Lucas Oliveira](https://github.com/LucasOliveiraaa)

<br />

## Contributing

Pull requests are welcome!
If you’d like to report a bug or suggest a feature, open an issue on [GitHub](https://github.com/LucasOliveiraaa/upstream-react).