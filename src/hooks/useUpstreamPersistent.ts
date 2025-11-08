import { createStoreFromStorage } from "../store/store";
import { hookMiddleware } from "./middleware";

let p;

if (typeof window !== "undefined") {
    p = createStoreFromStorage(
        window.localStorage,
        {
            name: "Persistent Store",
            isolate: true
        }
    );
}

export const persistentStore = p;

/**
 * React hook for persistent, localStorage-backed global state in Upstream.
 *
 * This hook behaves exactly like {@link useUpstream}, but its data
 * is stored in the browser's `localStorage` instead of in memory.
 *
 * All state updates are automatically synchronized with `localStorage`,
 * meaning that values persist across page reloads, browser sessions,
 * and component unmounts.
 *
 * ---
 * **Important — Isolation Notice**
 *
 * The underlying `"Global Local Store"` used by this hook is **isolated**:
 *
 * - It **does not inherit** or synchronize data from any parent store.
 * - It **cannot be set as a parent** of any other store.
 * - It is completely self-contained and independent.
 *
 * In other words, this hook does **not** follow the store inheritance or
 * synchronization rules used by other Upstream stores.  
 * Any state stored here exists only in this isolated `localStorage` store.
 * 
 * ---
 *
 * @example
 * // Persist theme preference across sessions
 * const [theme, setTheme] = useUpstreamPersistent("theme", "light");
 *
 * @example
 * // Persist a user token securely between reloads
 * const [token, setToken] = useUpstreamPersistent("authToken");
 *
 * @example
 * // Using a fetcher with persistent caching
 * const [profile, , { bound to custom storesrefetch }] = useUpstreamPersistent<User>(
 *   "/api/profile",
 *   (url) => fetch(url).then(res => res.json())
 * );
 *
 * @see {@link hookMiddleware} for creating custom hooks based on {@link useUpstream}
 * @see {@link useUpstream} for the base hierarchical store hook
 * @see {@link StoreConfig.isolate} for details on isolated stores
 */
export const useUpstreamPersistent = hookMiddleware({ store: persistentStore });