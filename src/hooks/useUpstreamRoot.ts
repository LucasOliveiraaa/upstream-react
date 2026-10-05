"use client";

import { useUpstreamConfig } from "../store/configuration";
import { globalStore } from "../core";
import type { Store } from "../core/types";
import { hookMiddleware } from "./middleware";

const getRoot = (store: Store): Store => store.parent ? getRoot(store.parent) : store;

/**
 * Same as {@link useUpstream}, but always reads and writes the root of the
 * current store hierarchy.
 */
export const useUpstreamRoot = hookMiddleware((_config) => {
    const config = useUpstreamConfig(_config);
    return { store: getRoot(config.store || globalStore) };
})
