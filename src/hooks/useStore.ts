"use client";

import { useEffect, useRef } from "react";
import { useUpstreamConfig } from "../store/configuration";
import type { ExtendedStoreConfig, Store } from "../core/types";
import { createStore, globalStore, isUndefined } from "../core";

/**
 * Creates a store scoped to the calling component, parented to the store
 * of the nearest {@link UpstreamProvider} (or the global store).
 *
 * No parent is assigned automatically when the store is isolated or has
 * lookup `parents`: such a store only reads from the stores it was given.
 *
 * When `autoDispose` is not `false`, the store is detached from its parent
 * when the component unmounts.
 */
export const useStore = (config: ExtendedStoreConfig = {}): Store => {
    const parentConfig = useUpstreamConfig();
    const standalone = config.isolate || !isUndefined(config.parents);
    const parentStore = config.parent || (standalone ? undefined : parentConfig.store || globalStore);

    const storeRef = useRef<Store | null>(null);

    if (!storeRef.current) {
        storeRef.current = createStore({
            ...config,
            parent: parentStore
        });
    } else if (storeRef.current.parent !== parentStore) {
        console.warn(
            "useStore: parent store changed after initialization. " +
            "This is not supported and will be ignored."
        );
    }

    const store = storeRef.current;
    const autoDispose = config.autoDispose ?? true;

    useEffect(() => {
        if (!autoDispose) return;

        // Re-attach in case a previous cleanup (e.g. StrictMode) detached it
        store.attach();
        return () => store.dispose();
    }, [store, autoDispose]);

    return store;
}
