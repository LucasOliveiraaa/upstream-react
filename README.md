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
    <UpstreamProvider store={store}>
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
      <h2>{user.name}</h2>
      <button onClick={() => setUser({ ...user, name: "Anonymous" })}>
        Anonymize
      </button>
    </div>
  );
}
```

The fetcher runs once, caches the result, and revalidates in the background when appropriate.
You can call `meta.refetch()` at any time to manually trigger a new fetch.

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

This is perfect for cases like multi-tenant dashboards, isolated testing environments, or dynamic UI overrides that should not affect the global state.

<br />

## Server-Side Rendering (SSR)

`upstream-react` works seamlessly with SSR frameworks like **Next.js** or **Remix**.

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
  const store = createStore({ initialState });
  return (
    <UpstreamProvider store={store}>
      <User />
    </UpstreamProvider>
  );
}
```

<br />

## License

MIT © [Lucas Oliveira](https://github.com/LucasOliveiraaa)

<br />

## Contributing

Pull requests are welcome!
If you’d like to report a bug or suggest a feature, open an issue on [GitHub](https://github.com/LucasOliveiraaa/upstream-react).