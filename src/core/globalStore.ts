import { createStore } from "./store";

// Avoids depending on @types/node, bundlers replace `process.env.NODE_ENV`
declare const process: { env?: Record<string, string | undefined> };

export const globalStore = createStore({
    name: "Global Store",
    autoDispose: false, // The global store must NOT be disposed
});

// On a server the global store lives as long as the process, so it's shared
// by every request: data written to it can leak from one user to another.
if (typeof window === "undefined"
    && typeof process !== "undefined"
    && process.env?.NODE_ENV !== "production") {
    const stop = globalStore.observe((key) => {
        stop();
        console.warn(
            `upstream-react: "${key}" was written to the global store on the server. ` +
            "The global store is shared by every request, create a store per request " +
            "and pass it through <UpstreamProvider config={{ store }}> instead."
        );
    });
}
