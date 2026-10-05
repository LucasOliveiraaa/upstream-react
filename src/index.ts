import { useUpstream } from "./hooks/useUpstream";

// React-free code: stores, mutate (see src/core/index.ts)
export {
    createStore,
    divergeStore,
    createStoreFromStorage,
    BaseStore,
    globalStore,
    mutate,
    revalidate,
    EventTypes,
} from "./core";
export type * from "./core";

export { useUpstream } from "./hooks/useUpstream";
export * from "./hooks/middleware";
export * from "./hooks/useStore";
export * from "./hooks/useUpstreamPersistent";
export * from "./hooks/useUpstreamRoot";
export { UpstreamProvider, useUpstreamConfig } from "./store/configuration";

export default useUpstream;
