/**
 * Everything that doesn't depend on React: stores, keys, mutations.
 *
 * Keep React imports out of this directory. React modules live in `hooks/`
 * and `store/configuration.tsx`, and are the only ones marked "use client".
 */
export { EventTypes } from "./types";
export { createStore, divergeStore, createStoreFromStorage, BaseStore } from "./store";
export { globalStore } from "./globalStore";
export { mutate, revalidate } from "./mutate";
export type * from "./types";
export type { MutateOptions } from "./mutate";

// Internal helpers, not re-exported by the package
export { parseArgs, parseKey } from "./utils/parse";
export { isConnected, isVisible } from "./utils/web";
export { isFunction, isUndefined } from "./utils/helpers";
