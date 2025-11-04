"use client";

import {
    UpstreamConfig,
    EventTypes,
    Fetcher,
    UpstreamHook,
    UpstreamResponse,
    Key,
    SetActionArg,
    Store,
} from "../types";
import {
    isFunction,
    isUndefined,
} from "../utils/helpers";
import { parseArgs, parseKey } from "../utils/parse";
import { useUpstreamConfig } from "../store/configuration";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isConnected, isVisible } from "../utils/web";
import { globalStore } from "../store/globalStore";

const useIsomorphicEffect =
    typeof window === "undefined" ? useEffect : useLayoutEffect;

export const useUpstreamHook = <T = any, E = any>(
    _key: Key,
    fallback?: T,
    fetcher?: Fetcher<T>,
    config?: UpstreamConfig
): UpstreamResponse<T, E> => {
    const resolvedConfig = useUpstreamConfig(config);

    const {
        store: _store,

        refetchWhenHidden,
        refetchWhenOffline,

        fetcher: scopeFetcher,
        onSuccess,
        onWait,

        errorRetries,
        errorRetryInterval,
        onError,
        onErrorRetry,

        fetchTimeout,
        onLoadingSlow,

        dedupeTimeSpan,

        refetchInterval,

        refetchOnFocus,
        refetchOnReconnect,
        refetchOnMount,
    } = resolvedConfig;

    const store = _store || globalStore;
    const { fetches } = store;

    const [key, arg] = parseKey(store.UUID, _key);

    const keyRef = useRef(key);
    const fetcherRef = useRef(fetcher || scopeFetcher);

    const mountedRef = useRef(false);
    const unmountedRef = useRef(false);

    const configRef = useRef(resolvedConfig);
    const cachedRef = useRef(store.get<T>(key))

    const [value, setValue] = useState<T | undefined>(() => {
        const cached = cachedRef.current;
        if (!isUndefined(cached)) return cached;
        if (!isUndefined(fallback)) return cached ?? fallback;
        if (!isUndefined(cached) && mountedRef.current) return cached;

        // If there's no fallback and the component didn't mount yet,
        // hold a constant value, in this case, undefined
        return undefined;
    });
    const [error, setError] = useState<E | undefined>();
    const [isFetching, setIsFetching] = useState<boolean>(fetcherRef.current !== undefined && cachedRef.current === undefined);

    // This key allows the user to know if the current key-value could be
    // store by a parsistent store. This is a guess, the real source is
    // hidden from us in this step.
    const fromPersistentStore = useMemo(
        () => {
            let isPersistent = (store: Store) => {
                if (store.config.persistent) return true;
                if (!isUndefined(store.parent)) return isPersistent(store.parent);
                return false;
            }

            return isPersistent(store);
        },
        [store]
    );

    const refetch = useCallback(async () => {
        if (!key
            || !fetcherRef.current
            || unmountedRef.current)
            return;

        if (key in fetches && !isUndefined(fetches[key][0])) {
            const fetch = fetches[key];

            const delta = Date.now() - fetch[1];
            if (delta < (dedupeTimeSpan ?? 2000)) {
                onWait?.(key);
                return;
            }
        }

        const cached = cachedRef.current;
        const config = configRef.current;
        const currentFetcher = fetcherRef.current;
        setIsFetching(true);

        try {
            fetches[key] = [currentFetcher(arg), Date.now()];

            if (!isUndefined(config.fetchTimeout) && isUndefined(cached)) {
                setTimeout(() => {
                    if (!isUndefined(fetches[key][0])) {
                        onLoadingSlow?.(key);
                    }
                }, Math.max(config.fetchTimeout, 1));
            }

            let result: T = await fetches[key][0];
            result = onSuccess?.(result, key) ?? result;

            store.set(key, result);

            fetches[key][0] = undefined;
            setIsFetching(false);

            if ((config.refetchWhenStale ?? true) && isUndefined(config.refetchInterval)) {
                setTimeout(refetch, Math.max(config.staleTimeSpan ?? 30000, 1))
            }
            return result;
        } catch (err: unknown) {
            const awaitCompletion = () => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(refetch())
                    }, errorRetryInterval ?? 2000)
                })
            }
            for (let i = 0; i < (config.errorRetries ?? 0); i++) {
                onErrorRetry?.(err as E, key, refetch);
                await awaitCompletion();
            }

            setError(onError?.(err as E, key) || err as E)
            setIsFetching(false);
            return undefined;
        }
    }, [key, store]);

    useIsomorphicEffect(() => {
        if (!key)
            return;

        const unsubscribe = store.subscribe(key, setValue);
        return unsubscribe
    }, [key]);

    useIsomorphicEffect(() => {
        fetcherRef.current = fetcher;
        configRef.current = resolvedConfig;
    });

    useIsomorphicEffect(() => {
        const cached = store.get<T>(key);

        // If there's a fallback but there's not a cached value, 
        // set the fallback as the cannonical value
        if (isUndefined(cached) && !isUndefined(fallback) && Boolean(key)) {
            store.set(key, fallback);
            cachedRef.current = fallback;
        } else {
            cachedRef.current = cached;
        }
    }, [key, fallback])

    useIsomorphicEffect(() => {
        if (!key) return;

        const cached = cachedRef.current;

        unmountedRef.current = false;
        mountedRef.current = true;
        keyRef.current = key;

        // Update value just after hydratation
        // This is required to prevent tree mismatch between SSR and CSR
        if (mountedRef.current && cached) {
            setValue(cached);
        }

        const handler = (type: EventTypes) => {
            if (type === EventTypes.Focus && refetchOnFocus) {
                refetch()
            } else if (type === EventTypes.Reconnect && refetchOnReconnect) {
                refetch()
            }
        };
        const unsubscribe = store.subscribeHandler(key, handler);

        if (refetchOnMount || isUndefined(cached)) {
            refetch();
        }

        return () => {
            unmountedRef.current = true;

            unsubscribe();
        }
    }, [key, refetchOnMount, refetchOnFocus, refetchOnReconnect]);

    // Refetch Interval pooling
    useIsomorphicEffect(() => {
        if (!key) return;

        let timer: any;

        const pool = () => {
            if (!isUndefined(refetchInterval) && timer !== -1) {
                setTimeout(execute, Math.max(refetchInterval, 1));
            }
        }

        const execute = () => {
            if (!error
                && (refetchWhenHidden || isVisible())
                && (refetchWhenOffline || isConnected())
            ) {
                refetch().then(pool);
            } else {
                pool();
            }
        }

        pool();

        return () => {
            if (timer) {
                clearTimeout(timer)
                timer = -1;
            }
        }
    }, [refetchInterval, refetchWhenHidden, refetchWhenOffline, key]);

    return [
        value,
        (newValue: SetActionArg<T>) => {
            if (!key) return;

            const updated = isFunction(newValue)
                ? (newValue as (old: T | undefined) => T)(value)
                : newValue;
            store.set(key, updated);
        },
        {
            error,
            isInitial: (isUndefined(cachedRef.current) && !isUndefined(fetcherRef.current)),
            isFetching,
            refetch,

            fromPersistentStore
        }
    ]
}

export const useUpstream: UpstreamHook = (...args: any[]) => {
    if (args.length === 0) {
        throw new Error("useStoreState needs, at least, one argument as a key");
    }

    const { key, initialValue, fetcher, config } = parseArgs(args);

    return useUpstreamHook(key!, initialValue, fetcher, config);
}