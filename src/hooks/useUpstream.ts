"use client";

import type {
    UpstreamConfig,
    Fetcher,
    UpstreamHook,
    UpstreamResponse,
    Key,
    SetActionArg,
    Store,
    SetAction,
} from "../core/types";
import {
    EventTypes,
    globalStore,
    isConnected,
    isFunction,
    isUndefined,
    isVisible,
    parseArgs,
    parseKey,
} from "../core";
import { useUpstreamConfig } from "../store/configuration";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const useIsomorphicEffect =
    typeof window === "undefined" ? useEffect : useLayoutEffect;

const noop = () => { };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isPersistent = (store: Store): boolean => {
    if (store.config.persistent) return true;
    if (!isUndefined(store.parent) && isPersistent(store.parent)) return true;
    return (store.parents || []).some(isPersistent);
}

const canRevalidate = (config: UpstreamConfig) =>
    (config.refetchWhenHidden || isVisible())
    && (config.refetchWhenOffline || isConnected());

const createTimeoutError = (ms: number) => {
    const error = new Error(`Fetch timed out after ${ms}ms`);
    error.name = "TimeoutError";
    return error;
}

/**
 * Runs the fetcher once, failing after `timeout` ms. The returned promise
 * rejects on timeout even if the fetcher ignores its signal.
 */
const fetchOnce = <T>(
    fetcher: Fetcher<T>,
    arg: unknown,
    parent: AbortController | undefined,
    timeout: number | undefined,
): Promise<T> => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    const abort = () => controller?.abort(parent?.signal.reason);
    parent?.signal.addEventListener("abort", abort);

    return new Promise<T>((resolve, reject) => {
        const timer = isUndefined(timeout) ? undefined : setTimeout(() => {
            const error = createTimeoutError(timeout);
            controller?.abort(error);
            reject(error);
        }, Math.max(timeout, 1));

        const cleanup = () => {
            clearTimeout(timer);
            parent?.signal.removeEventListener("abort", abort);
        }

        try {
            Promise.resolve(fetcher(arg, { signal: controller?.signal }))
                .then(resolve, reject)
                .finally(cleanup);
        } catch (err) {
            cleanup();
            reject(err);
        }
    });
}

export const useUpstreamHook = <T = any, E = any>(
    _key: Key,
    fallback?: T,
    fetcher?: Fetcher<T>,
    config?: UpstreamConfig
): UpstreamResponse<T, E> => {
    const resolvedConfig = useUpstreamConfig(config);

    const {
        refetchWhenHidden,
        refetchWhenOffline,
        refetchInterval,
        refetchOnMount,
    } = resolvedConfig;

    const store = resolvedConfig.store || globalStore;
    const [key, arg] = parseKey(store.UUID, _key);
    const activeFetcher = fetcher || resolvedConfig.fetcher;
    // Not inherited from providers: an initial value is specific to a key
    if (isUndefined(fallback)) fallback = config?.initialValue;

    // Latest render's values, read by async callbacks so they never go stale
    const fetcherRef = useRef(activeFetcher);
    const configRef = useRef(resolvedConfig);
    const fallbackRef = useRef(fallback);
    const argRef = useRef(arg);

    const unmountedRef = useRef(false);
    const staleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // The fallback is only shown until it has been written to the store for
    // this key. After that the store is the single source of truth, so
    // deleting the key really yields `undefined`.
    const seededKeyRef = useRef<string | null>(null);

    // This key allows the user to know if the current key-value could be
    // stored by a persistent store. This is a guess, the real source is
    // hidden from us in this step.
    const fromPersistentStore = useMemo(() => isPersistent(store), [store]);

    const subscribe = useCallback(
        (onChange: () => void) => key ? store.subscribe(key, onChange) : noop,
        [store, key]
    );
    const getSnapshot = () => key ? store.get<T>(key) : undefined;
    // Persistent values only exist on the client: render without them during
    // hydration so the markup matches the server, then update.
    const getServerSnapshot = () => fromPersistentStore ? undefined : getSnapshot();

    const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const value = isUndefined(stored) && seededKeyRef.current !== key ? fallback : stored;

    const [error, setError] = useState<E | undefined>();
    const [isFetching, setIsFetching] = useState<boolean>(
        () => Boolean(key) && !isUndefined(activeFetcher) && isUndefined(stored)
    );

    useIsomorphicEffect(() => {
        fetcherRef.current = activeFetcher;
        configRef.current = resolvedConfig;
        fallbackRef.current = fallback;
        argRef.current = arg;
    });

    const refetch = useCallback(async (): Promise<T | undefined> => {
        const currentFetcher = fetcherRef.current;
        if (!key || !currentFetcher || unmountedRef.current)
            return undefined;

        const config = configRef.current;
        const { fetches } = store;

        const settle = (err?: E) => {
            if (unmountedRef.current) return;
            setError(err);
            setIsFetching(false);
        }

        // Share an in-flight request for the same key instead of firing a new one
        const inflight = fetches[key];
        if (inflight && Date.now() - inflight[1] < (config.dedupeTimeSpan ?? 2000)) {
            config.onWait?.(key);
            setIsFetching(true);
            try {
                const result = await inflight[0];
                settle();
                return result;
            } catch (err) {
                settle(err as E);
                return undefined;
            }
        }

        setIsFetching(true);
        clearTimeout(staleTimerRef.current);

        // A newer request supersedes an older, too old to be shared, one
        inflight?.[2]?.abort();
        const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;

        const slowTimeout = config.loadingSlowTimeout ?? config.fetchTimeout;
        const slowTimer = !isUndefined(slowTimeout) && config.onLoadingSlow
            ? setTimeout(() => config.onLoadingSlow?.(key), Math.max(slowTimeout, 1))
            : undefined;

        const run = async (): Promise<T> => {
            const retries = config.errorRetries ?? 0;
            for (let attempt = 0; ; attempt++) {
                try {
                    const data = await fetchOnce(currentFetcher, argRef.current, controller, config.fetchTimeout);
                    if (controller?.signal.aborted) throw controller.signal.reason;

                    const result: T = config.transform ? config.transform(data, key) : data;
                    store.set(key, result);
                    config.onSuccess?.(result, key);
                    return result;
                } catch (err) {
                    if (attempt >= retries || unmountedRef.current || controller?.signal.aborted) throw err;

                    config.onErrorRetry?.(err as E, key, refetch);
                    await sleep(config.errorRetryInterval ?? 2000);
                }
            }
        }

        const entry: [Promise<T>, number, AbortController?] = [run(), Date.now(), controller];
        fetches[key] = entry;

        try {
            const result = await entry[0];
            settle();

            if ((config.refetchWhenStale ?? false) && !config.refetchInterval) {
                const staleTimeSpan = Math.max(config.staleTimeSpan ?? 30000, 1);
                const revalidate = () => {
                    if (unmountedRef.current) return;
                    if (canRevalidate(configRef.current)) refetch();
                    else staleTimerRef.current = setTimeout(revalidate, staleTimeSpan);
                }
                staleTimerRef.current = setTimeout(revalidate, staleTimeSpan);
            }
            return result;
        } catch (err: unknown) {
            // Superseded by a newer request (the only thing aborting this
            // controller): follow it, or stay quiet if it already settled
            const newer = fetches[key];
            if (controller?.signal.aborted) {
                if (!newer || newer === entry) {
                    settle();
                    return store.get<T>(key);
                }
                try {
                    const result = await newer[0];
                    settle();
                    return result;
                } catch (newerErr) {
                    settle(newerErr as E);
                    return undefined;
                }
            }

            config.onError?.(err as E, key);
            settle(err as E);
            return undefined;
        } finally {
            clearTimeout(slowTimer);
            if (fetches[key] === entry) delete fetches[key];
        }
    }, [key, store]);

    useIsomorphicEffect(() => {
        if (!key) return;

        unmountedRef.current = false;
        setError(undefined);

        const cached = store.get<T>(key);

        // If there's a fallback but there's not a cached value,
        // set the fallback as the canonical value
        seededKeyRef.current = key;
        if (isUndefined(cached) && !isUndefined(fallbackRef.current)) {
            store.set(key, fallbackRef.current);
        }

        const handler = (type: EventTypes) => {
            const config = configRef.current;
            if (type === EventTypes.Focus && (config.refetchOnFocus ?? true)) {
                refetch();
            } else if (type === EventTypes.Reconnect && (config.refetchOnReconnect ?? true)) {
                refetch();
            } else if (type === EventTypes.Revalidate) {
                refetch();
            }
        };
        const unsubscribe = store.subscribeHandler(key, handler);

        // A fallback is not fetched data, so it doesn't prevent the initial fetch
        if (refetchOnMount || isUndefined(cached)) {
            refetch();
        } else {
            setIsFetching(false);
        }

        return () => {
            unmountedRef.current = true;
            clearTimeout(staleTimerRef.current);
            unsubscribe();
        }
    }, [key, store, refetch, refetchOnMount]);

    // Refetch Interval polling
    useEffect(() => {
        if (!key || !refetchInterval) return;

        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;

        const poll = () => {
            if (!cancelled) timer = setTimeout(execute, Math.max(refetchInterval, 1));
        }

        const execute = () => {
            if (canRevalidate(configRef.current)) {
                refetch().finally(poll);
            } else {
                poll();
            }
        }

        poll();

        return () => {
            cancelled = true;
            clearTimeout(timer);
        }
    }, [refetchInterval, refetchWhenHidden, refetchWhenOffline, key, refetch]);

    const setAction = useCallback<SetAction<T>>(
        (newValue?: SetActionArg<T>) => {
            if (!key) return;

            let updated: T | undefined;
            if (isFunction(newValue)) {
                // Read the latest value so consecutive updates compose
                let current = store.get<T>(key);
                if (isUndefined(current) && seededKeyRef.current !== key) current = fallbackRef.current;
                updated = (newValue as (old: T | undefined) => T | undefined)(current);
            } else {
                updated = newValue;
            }

            if (isUndefined(updated))
                store.delete(key);
            else
                store.set(key, updated);
        },
        [key, store]
    );

    return [
        value,
        setAction,
        {
            error,
            isInitial: Boolean(key) && !isUndefined(activeFetcher) && isUndefined(value) && isUndefined(error),
            isFetching,
            refetch,

            fromPersistentStore
        }
    ]
}

export const useUpstream: UpstreamHook = (...args: any[]) => {
    if (args.length === 0) {
        throw new Error("useUpstream needs, at least, one argument as a key");
    }

    const { key, initialValue, fetcher, config } = parseArgs(args);

    return useUpstreamHook(key!, initialValue, fetcher, config);
}
