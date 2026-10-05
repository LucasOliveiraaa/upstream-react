import { EventTypes, type Key, type SetActionArg, type Store } from "./types";
import { globalStore } from "./globalStore";
import { isFunction, isUndefined } from "./utils/helpers";
import { parseKey } from "./utils/parse";

export interface MutateOptions<T> {
    /**
     * The store holding the key.
     *
     * @default globalStore
     */
    store?: Store;

    /**
     * Value shown immediately, while `data` (a promise) resolves.
     */
    optimisticData?: T;

    /**
     * When `true`, the previous value is restored if `data` rejects.
     *
     * @default true
     */
    rollbackOnError?: boolean;

    /**
     * When `true`, every mounted hook with a fetcher for this key refetches
     * once the mutation is applied.
     *
     * @default false, or `true` when `mutate` is called without data
     */
    revalidate?: boolean;
}

/**
 * Asks every mounted hook with a fetcher for `key` to refetch it.
 */
export function revalidate(key: Key, store: Store = globalStore): void {
    const [hashed] = parseKey(store.UUID, key);
    if (hashed) store.notifyHandlers(hashed, EventTypes.Revalidate);
}

/**
 * Updates a key from outside React, with optional optimistic updates.
 *
 * `data` can be a value, an updater function, or a promise (e.g. a request
 * returning the updated entity). Resolving to `undefined` deletes the key.
 * Without `data`, the key is only revalidated.
 *
 * @example
 * ```ts
 * // Show the new name right away, roll back if the request fails
 * await mutate("/api/me", api.rename("Ada"), {
 *   optimisticData: { ...user, name: "Ada" },
 * });
 *
 * // Increment from the latest value
 * mutate("counter", n => (n ?? 0) + 1);
 *
 * // Refetch everywhere
 * mutate("/api/me");
 * ```
 */
export async function mutate<T = any>(
    key: Key,
    ...args: [data?: SetActionArg<T> | Promise<T | undefined>, options?: MutateOptions<T>]
): Promise<T | undefined> {
    const [data, options = {}] = args;
    const store = options.store || globalStore;
    const [hashed] = parseKey(store.UUID, key);
    if (!hashed) return undefined;

    const shouldRevalidate = options.revalidate ?? args.length === 0;
    const apply = (value: T | undefined) => {
        if (isUndefined(value)) store.delete(hashed);
        else store.set(hashed, value);
    }

    if (args.length === 0) {
        revalidate(key, store);
        return store.get<T>(hashed);
    }

    const previous = store.get<T>(hashed);
    if (!isUndefined(options.optimisticData)) apply(options.optimisticData);

    let result: T | undefined;
    try {
        result = isFunction(data)
            ? (data as (prev: T | undefined) => T | undefined)(store.get<T>(hashed))
            : await data;
    } catch (err) {
        if (options.rollbackOnError ?? true) apply(previous);
        throw err;
    }

    apply(result);
    if (shouldRevalidate) revalidate(key, store);
    return result;
}
