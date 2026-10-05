/* eslint-disable @typescript-eslint/no-unused-vars -- variables here only exist to check their types */
/**
 * Type-level tests: compiled by `pnpm typecheck` (tsconfig.test.json), never
 * run. Each `expectType` fails to compile when inference changes, which is
 * how a TypeScript update once silently broke `useUpstream(key, fetcher)`.
 */
import React from "react";
import useUpstream, {
    createStore,
    createStoreFromStorage,
    globalStore,
    hookMiddleware,
    mutate,
    UpstreamProvider,
    useStore,
    useUpstreamPersistent,
} from "../src";

type User = { id: number; name: string };
declare const fetchUser: (url: string) => Promise<User>;
declare const fetchJson: (url: string, opts: { signal?: AbortSignal }) => Promise<any>;
declare const user: User | undefined;

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const expectType = <A, B>(_check: Equals<A, B>) => { };

export function TypeChecks() {
    // Inference from initial values and fetchers
    const [count] = useUpstream("count", 0);
    expectType<typeof count, number | undefined>(true);

    const [me] = useUpstream("/api/me", fetchUser);
    expectType<typeof me, User | undefined>(true);

    const [me2] = useUpstream("/api/me", fetchUser, { errorRetries: 2 });
    expectType<typeof me2, User | undefined>(true);

    const [cart] = useUpstream<string[]>("cart");
    expectType<typeof cart, string[] | undefined>(true);

    // transform changes the stored type
    const [names] = useUpstream("/api/users", fetchUser, { transform: u => u.name });
    expectType<typeof names, string | undefined>(true);

    // Options object
    const [onSave] = useUpstream("onSave", { initialValue: (): void => { } });
    expectType<typeof onSave, (() => void) | undefined>(true);

    // Explicit type arguments still work with untyped fetchers
    const [explicit] = useUpstream<User>("/api/me", fetchJson);
    expectType<typeof explicit, User | undefined>(true);
    const [explicitWithError, , { error }] = useUpstream<User, Error>("/api/me", fetchJson, { errorRetries: 1 });
    expectType<typeof explicitWithError, User | undefined>(true);
    expectType<typeof error, Error | undefined>(true);

    // Dependent keys may resolve to undefined
    useUpstream(() => user && ["/api/posts", user.id], fetchJson);

    // Middleware hooks keep the same inference
    const [persisted] = useUpstreamPersistent("/api/me", fetchUser);
    expectType<typeof persisted, User | undefined>(true);
    const useApi = hookMiddleware({ fetcher: fetchJson, errorRetries: 3 });
    const [viaApi] = useApi<User>("/api/me");
    expectType<typeof viaApi, User | undefined>(true);

    // The setter accepts values and updaters, not other types
    const [, setCount] = useUpstream("count", 0);
    setCount(1);
    setCount(n => (n ?? 0) + 1);
    // @ts-expect-error a string isn't a number
    setCount("1");

    mutate<number>("count", n => (n ?? 0) + 1);

    // Stores
    const scoped = useStore({ parents: [globalStore], initialValues: { a: 1 } });
    const session = createStoreFromStorage(sessionStorage, { prefix: "app:", persistent: true });
    createStore({ parent: scoped, parents: [session], syncWithParents: false }).diverge({ name: "x" });

    return (
        <UpstreamProvider config={parent => ({ errorRetries: (parent?.errorRetries ?? 0) + 1 })}>
            <UpstreamProvider config={{ store: scoped, fetcher: fetchJson }}>{String(count)}</UpstreamProvider>
        </UpstreamProvider>
    );
}
