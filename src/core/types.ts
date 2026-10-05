export type MutationObserver = (value: any, prev: any) => void;
/** Observes every change in a store, see {@link Store.observe} */
export type StoreObserver = (key: string, value: any, prev: any) => void;
export type Unsubscriber = () => void;
export type Subscriber = (key: string, callback: MutationObserver) => Unsubscriber;

export enum EventTypes {
    Focus = "focus",
    Reconnect = "reconnect",
    WindowSync = "window-sync",
    Revalidate = "revalidate",
}

export type EventHandlerCallback = (type: EventTypes, ...args: any[]) => void

export interface StoreProvider {
    get(key: string): any | undefined,
    set(key: string, value: any): any | undefined,
    delete(key: string): void,
    keys(): IterableIterator<string>
}

export interface Wave {
    type: string,
    payload: any,
    source: Store,
    blockWave: boolean,
}

export type WaveObserver = (wave: Wave) => void;

export interface Store {
    fetches: Record<string, [Promise<any>, number, AbortController?]>;

    UUID: string;
    name: string;

    config: StoreConfig;
    parent?: Store;
    /**
     * Read-only stores searched, in order, for keys this store and its
     * {@link Store.parent} don't have. See {@link ExtendedStoreConfig.parents}.
     */
    parents: Store[];

    get<T>(key: string): T | undefined;
    
    set<T>(key: string, value: T): T | undefined;
    setAndDontNotify<T>(key: string, value: T): T | undefined;

    delete(key: string): void;
    has(key: string): boolean;

    wave(type: string, payload: any): void;
    wave(wave: Wave): void;

    dispatchWave(wave: Wave): void;
    observeWave(observer: WaveObserver): () => void;

    clone(): Store;
    diverge(config?: ExtendedStoreConfig): Store;

    subscribe(key: string, callback: MutationObserver): Unsubscriber;
    /** Observes changes of every key, including inherited ones */
    observe(observer: StoreObserver): Unsubscriber;
    /**
     * Notifies subscribers of `key` that its value changed, without writing.
     * Used by stores whose provider can change on its own (e.g. other tabs).
     */
    notify(key: string, value: any, prev: any): void;

    subscribeHandler(key: string, handler: EventHandlerCallback): () => void;
    notifyHandlers(key: string, type: EventTypes, ...args: any[]): void;

    serialize(): string;

    /** Registers this store as a child of its parent (idempotent) */
    attach(): void;
    /** Unregisters this store from its parent's children */
    detach(): void;
    /** Detaches the store and removes every listener it owns */
    dispose(): void;
}

export type HierarchicalStore = Store & {
    readonly upstreamUUIDs: Set<string>;
    children: Store[];
};

export type Refetcher<T> = () => Promise<T | undefined>;

/** Config with a {@link UpstreamConfig.transform} from the fetcher's data `R` to the stored `T` */
export type TransformConfig<T, E, R> = Omit<UpstreamConfig<T, E>, "transform" | "fetcher"> & {
    transform: (data: R, key: string) => T,
};

/** The data type a fetcher resolves to */
export type FetchedData<F> = F extends (...args: any[]) => infer R ? Awaited<R> : never;

export interface UpstreamHook {
    <R, T, E = any>(key: Key, fetcher: Fetcher<R>, config: TransformConfig<T, E, R>): UpstreamResponse<T, E>,
    // Generic over the whole fetcher so inference doesn't fall through to the
    // `initialValue` overloads: when several overloads match, TypeScript first
    // picks one whose parameters match *exactly* (subtype relation), and
    // `(url: string) => ...` isn't a subtype of `Fetcher<T>` (key: any).
    <F extends Fetcher<any>, E = any>(key: Key, fetcher: F): UpstreamResponse<FetchedData<F>, E>,
    <F extends Fetcher<any>, E = any>(key: Key, fetcher: F, config: UpstreamConfig<FetchedData<F>, E>): UpstreamResponse<FetchedData<F>, E>,
    <T = any, E = any>(key: Key): UpstreamResponse<T, E>,
    // For explicit type arguments: useUpstream<User>(key, fetcher)
    <T = any, E = any>(key: Key, fetcher: Fetcher<T>): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, fetcher: Fetcher<T>, config: UpstreamConfig<T, E>): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, config: UpstreamConfig<T, E>): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, initialValue: T): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, initialValue: T, config: UpstreamConfig<T, E>): UpstreamResponse<T, E>,
}

export type UpstreamResponse<T = any, E = any> = [
    T | undefined, // Data
    SetAction<T>, // Set data

    {
        error: E | undefined,

        isInitial: boolean,
        isFetching: boolean,

        refetch: Refetcher<T>,

        fromPersistentStore: boolean,
    }
]

export type SetActionArg<T> = T | ((prev: T | undefined) => T | undefined);
export type SetAction<T> = (newValue?: SetActionArg<T>) => void;

export type Arg = string | any[] | object | false | null | undefined;
export type Key = (() => Arg) | Arg;

export type FetcherResponse<T> = T | Promise<T>

export interface FetcherOptions {
    /**
     * Aborted when the request times out (see {@link UpstreamConfig.fetchTimeout})
     * or is superseded by a newer request for the same key.
     */
    signal: AbortSignal | undefined;
}

export type Fetcher<T = any> = (key: any, options: FetcherOptions) => FetcherResponse<T>;

/**
 * Configuration options for {@link useUpstream}, controlling how data is fetched,
 * cached, refreshed, and how errors or lifecycle events are handled.
 *
 * @template T - The type of data returned by the fetcher.
 * @template E - The type of error object thrown during fetching.
 */
export interface UpstreamConfig<T = any, E = any> {
    /**
     * The store instance where data and state will be persisted.
     * 
     * If not provided, defaults to the global store.
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/user", fetcher, { store: userStore });
     * ```
     */
    store?: Store;

    /**
     * Initial value for the key, written to the store if it's empty.
     * Same as passing it as the second argument, but unambiguous for
     * values that are functions or look like a config object.
     *
     * Only read from the config passed to the hook, never from an {@link UpstreamProvider}.
     *
     * @example
     * ```ts
     * const [filters] = useUpstream("filters", { initialValue: { store: "all" } });
     * ```
     */
    initialValue?: T;

    /**
     * When `true`, forces data to be re-fetched when the page is hidden
     *
     * @default false
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/data", fetcher, { refetchWhenHidden: true });
     * ```
     */
    refetchWhenHidden?: boolean;

    /**
     * When `true`, forces data to be re-fetched when the page is offline
     *
     * @default false
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/data", fetcher, { refetchWhenOffline: true });
     * ```
     */
    refetchWhenOffline?: boolean;

    /**
     * The function used to fetch data for this key.
     *
     * The function receives the parsed key (often a URL or tuple) and an
     * options object with an `AbortSignal`, and should return a Promise
     * resolving to the data.
     *
     * @example
     * ```ts
     * const fetcher = (url: string, { signal }) => fetch(url, { signal }).then(res => res.json());
     * const [data] = useUpstream("/api/user", { fetcher });
     * ```
     */
    fetcher?: Fetcher<T>;

    /**
     * Transforms fetched data before it's written to the store.
     *
     * @example
     * ```ts
     * const [names] = useUpstream("/api/users", fetcher, {
     *   transform: (users) => users.map(u => u.name),
     * });
     * ```
     */
    transform?: (data: any, key: string) => T;

    /**
     * Called after a successful fetch, with the (transformed) data.
     *
     * Its return value is ignored, use {@link transform} to change the data.
     *
     * @param {T} data - The successfully fetched data.
     * @param {string} key - The associated store key.
     */
    onSuccess?: (data: T, key: string) => void;

    /**
     * Called when a fetch request for the same key is already in progress
     * and the current call must wait for that pending result.
     *
     * @param {string} key - The key being awaited.
     */
    onWait?: (key: string) => any;

    /**
     * The number of times to retry a failed request before giving up.
     *
     * @default 0
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/items", fetcher, { errorRetries: 3 });
     * ```
     */
    errorRetries?: number;

    /**
     * Time in milliseconds to wait between retry attempts after a fetch error.
     *
     * @default 2000
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/items", fetcher, { errorRetryInterval: 1000 });
     * ```
     */
    errorRetryInterval?: number;

    /**
     * Called when a fetch operation fails after every retry.
     *
     * Useful for centralized error handling or notifications.
     * Its return value is ignored.
     *
     * @param {E} error - The error that occurred.
     * @param {string} key - The store key associated with the error.
     */
    onError?: (error: E, key: string) => void;

    /**
     * Called before retrying a failed fetch operation.
     *
     * Allows you to modify behavior before a retry or log retry attempts.
     *
     * @param {E} error - The last error thrown.
     * @param {string} key - The store key being retried.
     * @param {Refetcher<T>} refetch - A function to force data refetch.
     */
    onErrorRetry?: (error: E, key: string, refetch: Refetcher<T>) => any;

    /**
     * Maximum duration (in milliseconds) before a fetch request times out.
     *
     * On timeout the fetcher's `signal` is aborted and the request fails
     * with a `TimeoutError` (retries still apply).
     *
     * @default undefined (no timeout)
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/data", fetcher, { fetchTimeout: 5000 });
     * ```
     */
    fetchTimeout?: number;

    /**
     * Time in milliseconds after which a pending fetch is considered slow
     * and {@link onLoadingSlow} is called.
     *
     * @default fetchTimeout
     */
    loadingSlowTimeout?: number;

    /**
     * Called when the fetcher takes longer than `loadingSlowTimeout`
     *
     * @param {string} key - The store key being slow.
     */
    onLoadingSlow?: (key: string) => void;

    /**
     * Time window (in milliseconds) within which multiple fetch calls for the same key
     * will be deduplicated and share the same in-flight request.
     *
     * @default 2000
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/items", fetcher, { dedupeTimeSpan: 1000 });
     * ```
     */
    dedupeTimeSpan?: number;

    /**
     * Interval (in milliseconds) for automatic periodic re-fetching of data.
     *
     * Set to `0` or omit to disable interval-based refetching.
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/stats", fetcher, { refetchInterval: 10000 });
     * ```
     */
    refetchInterval?: number;

    /**
     * When `true`, automatically refetches data when the browser window regains focus
     * (or the page becomes visible again).
     *
     * @default true
     */
    refetchOnFocus?: boolean;

    /**
     * When `true`, automatically refetches data when the browser reconnects after being offline.
     *
     * @default true
     */
    refetchOnReconnect?: boolean;

    /**
     * When `true`, triggers an initial refetch when the component mounts,
     * even if cached data already exists.
     *
     * @default false
     */
    refetchOnMount?: boolean;

    /**
     * When `true`, automatically re-fetches stale data based on the configured `staleTimeSpan`.
     *
     * @default false
     */
    refetchWhenStale?: boolean;

    /**
     * The duration (in milliseconds) after which cached data is considered stale.
     *
     * Used together with `refetchWhenStale` to control cache freshness.
     *
     * @default 30000
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/products", fetcher, { staleTimeSpan: 60000 });
     * ```
     */
    staleTimeSpan?: number;
};

/**
 * Configuration options for a {@link Store} instance.
 * 
 * This interface defines how a store behaves within the global store tree,
 * including synchronization, lifecycle management, and event handling.
 */
export interface StoreConfig {
    /**
     * When `true`, isolates this store from the global store hierarchy.
     * 
     * An isolated store does not sync with parent or child stores.
     * This implicitly sets `syncUp`, `stayInSync` and `syncDown` to `false`.
     *
     * @default false
     *
     * @example
     * ```ts
     * const isolatedStore = createStore({ isolate: true });
     * ```
     */
    isolate?: boolean;

    /**
     * When `true`, changes in this store are propagated upward to its parent store.
     *
     * If `false`, updates made to this store will not affect its parent.
     *
     * @default true
     *
     * @example
     * ```ts
     * const store = createStore({ syncUp: false });
     * ```
     */
    syncUp?: boolean;

    /**
     * When `true`, non existing keys in this store will be fetched from its parent store.
     * 
     * If `false`, the parent store will be ignored in upstream sync.
     * 
     * @default true
     * 
     * @example 
     * ```ts
     * const store = createStore({ stayInSync: false });
     * ```
     */
    stayInSync?: boolean;

    /**
     * When `true`, allows child stores to stay synchronized with this store.
     *
     * If `false`, children will not receive updates from this store.
     *
     * @default true
     *
     * @example
     * ```ts
     * const store = createStore({ syncDown: false });
     * ```
     */
    syncDown?: boolean;

    /**
     * When `true`, a store created with {@link useStore} is disposed (detached
     * from its parents, listeners removed) when the component unmounts.
     *
     * Stores created with `createStore` are never disposed automatically,
     * call `store.dispose()` when you're done with them.
     *
     * @default true
     *
     * @example
     * ```ts
     * // Keep the store attached after the component unmounts
     * const store = useStore({ autoDispose: false });
     * ```
     */
    autoDispose?: boolean;

    /**
     * Defines if this store is persistent
     *
     * @default false
     *
     * @example
     * ```ts
     * const store = createStore({ persistent: true });
     * ```
     */
    persistent?: boolean;

    /**
     * Optional callback invoked whenever a key-value pair in the store changes.
     *
     * Called after the mutation occurs, providing the key, the new value,
     * and the previous value.
     *
     * @param {string} key - The key that was modified.
     * @param {any} value - The new value associated with the key.
     * @param {any | undefined} prev - The previous value associated with the key, or `undefined` if none.
     *
     * @example
     * ```ts
     * const store = createStore({
     *   onChange: (key, value, prev) => {
     *     console.log(`Key ${key} changed from`, prev, "to", value);
     *   },
     * });
     * ```
     */
    onChange?: (key: string, value: any, prev: any | undefined) => void;

    /**
     * When `true`, keys missing from this store (and its `parent`) are
     * searched in its lookup {@link ExtendedStoreConfig.parents}, in order.
     *
     * @default true
     */
    lookupParents?: boolean;

    /**
     * When `true`, values found in lookup parents stay live: when they change
     * in the parent, this store's subscribers are notified.
     *
     * When `false`, a value found in a lookup parent is copied into this store
     * the first time it's read, and later changes in the parent are ignored.
     *
     * Either way, this store never writes to its lookup parents.
     *
     * @default true
     */
    syncWithParents?: boolean;
};

export type ExtendedStoreConfig = StoreConfig & { 
    /**
     * The display name of this store.
     * 
     * Useful for debugging or identifying a store instance when inspecting
     * global contexts or nested store trees.
     *
     * @example
     * ```ts
     * const userStore = createStore({ name: "UserStore" });
     * ```
     */
    name?: string,

    provider?: StoreProvider,
    
    parent?: Store,

    /**
     * Read-only stores this store looks keys up in, after itself and its
     * `parent`, in order. Unlike `parent`:
     *
     * - this store is never written to them (no `syncUp`),
     * - this store doesn't become their child (no waves, no `syncDown`),
     * - they may be isolated stores, and an isolated store may have them.
     *
     * Controlled by `lookupParents` and `syncWithParents`.
     *
     * @example
     * ```ts
     * // Reads app config and user info, but its own writes stay local
     * const protectedStore = createStore({
     *   name: "Protected",
     *   parents: [globalStore, userStore],
     * });
     * ```
     */
    parents?: Store[],

    /**
     * A string produced by `store.serialize()`, restoring that store's values,
     * name and config.
     */
    initialState?: string,

    /**
     * Values the store starts with, as `{ key: value }`. String keys are the
     * same keys `useUpstream` uses, so `{ "/api/me": user }` is read by
     * `useUpstream("/api/me")`.
     *
     * They're only written to this store, not to its parents, even with `syncUp`.
     * Handy to pass data fetched on the server to a client component.
     *
     * @example
     * ```ts
     * const store = createStore({ initialValues: { theme: "dark", "/api/me": user } });
     * ```
     */
    initialValues?: Record<string, unknown>,
};

export type StorageStoreConfig = ExtendedStoreConfig & {
    /**
     * Prefix added to every key written to the storage. Only keys with this
     * prefix belong to the store, so it won't list or serialize foreign entries.
     *
     * @default ""
     */
    prefix?: string,
};