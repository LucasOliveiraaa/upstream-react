import { useUpstream } from "./hooks/useUpstream";
export * from "./hooks/middleware";
export * from "./hooks/useUpstreamPersistent";
export * from "./hooks/useUpstreamRoot";

export { UpstreamProvider } from "./store/configuration";
export { createStore, divergeStore, createStoreFromStorage } from "./store/store";
export { globalStore } from "./store/globalStore";

export default useUpstream;