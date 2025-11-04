import { useUpstreamConfig } from "../store/configuration";
import { globalStore } from "../store/globalStore";
import type { Store } from "../types";
import { isUndefined } from "../utils/helpers";
import { hookMiddleware } from "./middleware";

export const useUpstreamRoot = hookMiddleware((_config) => {
    const config = useUpstreamConfig(_config);

    let getParent = (store: Store) => {
        if (isUndefined(store.parent)) return store;

        return getParent(store.parent);
    }

    return { store: getParent(config.store || globalStore) };
})