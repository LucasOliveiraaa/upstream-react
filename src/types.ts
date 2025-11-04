export type MutationObserver = (value: any, prev: any) => void;
export type Unsubscriber = () => void;
export type Subscriber = (key: string, callback: MutationObserver) => Unsubscriber;

export enum EventTypes {
    Focus = "focus",
    Reconnect = "reconnect",
    WindowSync = "window-sync",
}

export type EventHandlerCallback = (type: EventTypes, ...args: any[]) => void

export interface StoreProvider {
    get(key: string): any | undefined,
    set(key: string, value: any): any | undefined,
    delete(key: string): void,
    keys(): IterableIterator<string>
}

export interface Store {
    handlers: Record<string, EventHandlerCallback[]>;
    fetches: Record<string, [FetcherResponse<any>, number]>;
    subscribers: Record<string, MutationObserver[]>;

    UUID: string;
    name: string;

    provider: StoreProvider;
    config: StoreConfig;
    parent?: Store;
    children: Store[];

    teardown: (() => void)[];

    get<T>(key: string): T | undefined;
    
    set<T>(key: string, value: T): T | undefined;
    setAndDontNotify<T>(key: string, value: T): T | undefined;

    delete(key: string): void;
    has(key: string): boolean;

    clone(): Store;
    diverge(config?: ExtendedStoreConfig): Store;

    subscribe(key: string, callback: MutationObserver): Unsubscriber;

    subscribeHandler(key: string, handler: EventHandlerCallback): () => void;
    notifyHandlers(key: string, type: EventTypes, ...args: any[]): void;

    serialize(): string;
}

export type Refetcher<T> = () => Promise<T | undefined>;

export interface UpstreamHook {
    <T = any, E = any>(key: Key): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, config: UpstreamConfig): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, initialValue: T): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, initialValue: T, config: UpstreamConfig): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, fetcher: Fetcher<T>): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, fetcher: Fetcher<T>, config: UpstreamConfig): UpstreamResponse<T, E>,
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

export type SetActionArg<T> = T | ((prev: T | undefined) => T);
export type SetAction<T> = (newValue: SetActionArg<T>) => void;

export type Arg = string | any[] | object | false | null;
export type Key = (() => Arg) | Arg;

export type FetcherResponse<T> = T | Promise<T>
export type Fetcher<T = any> = (key: Arg) => FetcherResponse<T>;

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
     * The function receives the parsed key (often a URL or tuple)
     * and should return a Promise resolving to the data.
     *
     * @example
     * ```ts
     * const fetcher = (url: string) => fetch(url).then(res => res.json());
     * const [data] = useUpstream("/api/user", { fetcher });
     * ```
     */
    fetcher?: Fetcher<T>;

    /**
     * Called after a successful fetch or data update.
     *
     * Can be used to perform side effects such as logging or state synchronization.
     *
     * @param {T} data - The successfully fetched or updated data.
     * @param {string} key - The associated store key.
     */
    onSuccess?: (data: T, key: string) => any;

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
     * Called when a fetch operation throws an error.
     *
     * Useful for centralized error handling or notifications.
     *
     * @param {E} error - The error that occurred.
     * @param {string} key - The store key associated with the error.
     */
    onError?: (error: E, key: string) => any;

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
     * @default undefined (no timeout)
     *
     * @example
     * ```ts
     * const [data] = useUpstream("/api/data", fetcher, { fetchTimeout: 5000 });
     * ```
     */
    fetchTimeout?: number;

    /**
     * Called when fetcher takes more than defined in `fetchTimeout`
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
     * When `true`, automatically refetches data when the browser window regains focus.
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
     * @default true
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
     * When `true`, automatically disposes (unsubscribes and removes) this store
     * from the global context when there are no more active MutationObservers.
     *
     * This helps prevent memory leaks in long-lived applications.
     *
     * @default true
     *
     * @example
     * ```ts
     * const store = createStore({ autoDispose: true });
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

    initialState?: string,
};