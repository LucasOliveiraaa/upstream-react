import { createStore } from "./store";

export const globalStore = createStore({
    name: "Global Store",
    autoDispose: false, // The global store must NOT be disposed
});