# Getting started

## Requirements

- React 18 or 19
- Any bundler or framework (Vite, Next.js, Remix, Create React App, ...)
- TypeScript is optional, but fully supported

## Installation

```bash
npm install upstream-react
# or
yarn add upstream-react
# or
pnpm add upstream-react
```

`react` is a peer dependency: the library uses the copy your app already has.

## Your first shared state

`useUpstream` works like `useState`, except the state is identified by a **key** and shared by every
component using that key.

```tsx
import useUpstream from "upstream-react";

function ThemeToggle() {
  const [theme, setTheme] = useUpstream("theme", "light");

  return (
    <button onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}>
      Switch to {theme === "light" ? "dark" : "light"}
    </button>
  );
}

function Header() {
  const [theme] = useUpstream("theme");
  return <header className={theme}>My app</header>;
}
```

There's no provider to set up and no store to create: by default, values live in a **global store**.
Clicking the button updates `Header` too, because both components read the `"theme"` key.

The second argument, `"light"`, is the **initial value**. It's written to the store the first time a
component uses the key, so `Header` sees `"light"` too, even though it doesn't pass an initial value.

## Your first fetch

Pass a function instead of a value and it becomes a **fetcher**: `useUpstream` calls it with the key
and stores the result.

```tsx
type User = { name: string };

const fetchJson = (url: string, { signal }: { signal?: AbortSignal }) =>
  fetch(url, { signal }).then(res => res.json());

function Profile() {
  const [user, , { isFetching, error }] = useUpstream<User>("/api/me", fetchJson);

  if (error) return <p>Couldn't load your profile.</p>;
  if (!user) return <p>Loading...</p>;
  return <p>Hello, {user.name}{isFetching && " (refreshing)"}</p>;
}
```

The result is cached under the `"/api/me"` key, so every component reading that key shares it, and
the request isn't repeated when another component mounts. The data is refetched when the window
regains focus or the network reconnects.

## Where to go next

- [Core concepts](./core-concepts.md) explains keys and stores, which everything else builds on.
- [Fetching data](./fetching.md) covers loading states, retries, timeouts and revalidation.
- [Providers](./providers.md) shows how to scope state to a part of your app.
