import { useRef } from "react";
import { useUpstreamConfig } from "../store/configuration";
import { globalStore } from "../store/globalStore";
import type { ExtendedStoreConfig, Store } from "../types";
import { createStore } from "../store/store";

export const useStore = (config: ExtendedStoreConfig): Store => {
    const parentConfig = useUpstreamConfig();
    const parentStore = parentConfig.store || globalStore;

    const storeRef = useRef<Store | null>(null);
    const initialParentRef = useRef<Store | null>(null);

    if (!initialParentRef.current) {
        initialParentRef.current = parentStore;
    } else if (initialParentRef.current !== parentStore) {
        console.warn(
            "useStore: parent store changed after initialization. " +
            "This is not supported and will be ignored."
        );
    }

    if (!storeRef.current) {
        storeRef.current = createStore({
            ...config,
            parent: parentStore
        });
    }

    return storeRef.current;
}