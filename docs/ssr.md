# Server-side rendering

`upstream-react` renders on the server like any React code. Hooks don't fetch during server rendering
(effects don't run there): they render the store's current value or the initial value, and fetch once
the page is hydrated in the browser.

To render real data on the server, fetch it before rendering, put it in a store, and send that store to
the browser.

## One store per request

> **Never write to the global store on the server.** On a server, the global store lives as long as
> the process and is shared by every request, so one user's data could end up in another user's page.
> A warning is logged in development when it happens.

Create a store for each request instead, and give it to your components with a provider.

## Next.js (pages router)

Pass the data as props, and seed a store with `initialValues`:

```tsx
import useUpstream, { useStore, UpstreamProvider } from "upstream-react";

export async function getServerSideProps() {
  return { props: { initialValues: { "/api/me": await fetchUser() } } };
}

export default function Page({ initialValues }: { initialValues: Record<string, unknown> }) {
  // Created once, on the first render, with the server's data
  const store = useStore({ initialValues });

  return (
    <UpstreamProvider config={{ store }}>
      <Profile />
    </UpstreamProvider>
  );
}

function Profile() {
  // Has a value on the first render, both on the server and in the browser,
  // so it doesn't fetch on mount
  const [user] = useUpstream("/api/me", fetchJson);
  return <h1>{user?.name}</h1>;
}
```

String keys are stored as-is, so the `"/api/me"` entry is what `useUpstream("/api/me")` reads.

Seeded values stay in the page's store: they aren't written to its parent (the global store).

### Sending a whole store

When you already have a store on the server, send it with `serialize()` and restore it with
`initialState`, which also restores the store's name and config:

```tsx
export async function getServerSideProps() {
  const store = createStore();                 // one per request
  store.set("/api/me", await fetchUser());
  store.set("/api/settings", await fetchSettings());
  return { props: { initialState: store.serialize() } };
}

export default function Page({ initialState }: { initialState: string }) {
  const store = useStore({ initialState });
  // ...
}
```

## Next.js (app router) and React Server Components

Everything React-related in the library is a client module (it ships with `"use client"`), so you can
render `UpstreamProvider` directly from a server component. Stores are client-side too:

> **`createStore` and `mutate` can't be called from a server component.** Fetch the data in the
> server component and pass it as props to a client component that creates the store.

```tsx
// app/page.tsx (server component)
import { ClientRoot } from "./client-root";

export default async function Page() {
  const user = await fetchUser();
  return <ClientRoot initialValues={{ "/api/me": user }} />;
}
```

```tsx
// app/client-root.tsx
"use client";
import { useStore, UpstreamProvider } from "upstream-react";

export function ClientRoot({ initialValues }: { initialValues: Record<string, unknown> }) {
  const store = useStore({ initialValues });
  return (
    <UpstreamProvider config={{ store }}>
      <Profile />
    </UpstreamProvider>
  );
}
```

Values passed from a server component to a client component must be serializable (plain objects,
arrays, strings, numbers, dates...).

## Remix / React Router

Same idea: return the data from your loader, read it with `useLoaderData()`, and seed a store with
`useStore({ initialValues })` in the route component.

## Persistent values

Values in `localStorage` don't exist on the server. Hooks bound to persistent stores render their
initial value on the server and during hydration, then update. See
[persistence](./persistence.md#hydration).
