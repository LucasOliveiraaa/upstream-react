import { useUpstream } from "./hooks/useUpstream";
export * from "./hooks/middleware";
export * from "./hooks/useStore";
export * from "./hooks/useUpstreamPersistent";
export * from "./hooks/useUpstreamRoot";

export * from "./types"

export { UpstreamProvider } from "./store/configuration";
export { createStore, divergeStore, createStoreFromStorage } from "./store/store";
export { globalStore } from "./store/globalStore";
export { useUpstreamConfig } from "./store/configuration";

export default useUpstream;