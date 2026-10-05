import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import useUpstream, {
    createStore,
    divergeStore,
    useUpstreamRoot,
    UpstreamProvider,
    useStore,
} from "../src";
import { stableStringify } from "../src/core/utils/hash";

describe("regressions", () => {
    it("runs a fetcher provided through config", async () => {
        const store = createStore();
        const fetcher = jest.fn().mockResolvedValue("from-config");
        const { result } = renderHook(() => useUpstream("cfgFetcher", { fetcher, store }));

        await waitFor(() => expect(result.current[0]).toBe("from-config"));
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("runs a fetcher provided through UpstreamProvider", async () => {
        const store = createStore();
        const fetcher = jest.fn().mockResolvedValue("from-provider");
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <UpstreamProvider config={{ fetcher, store }}>{children}</UpstreamProvider>
        );
        const { result } = renderHook(() => useUpstream("providerFetcher"), { wrapper });

        await waitFor(() => expect(result.current[0]).toBe("from-provider"));
    });

    it("re-renders when a value is deleted", async () => {
        const store = createStore();
        const { result } = renderHook(() => useUpstream<string>("del", "x", { store }));
        expect(result.current[0]).toBe("x");

        act(() => result.current[1](undefined));
        await waitFor(() => expect(result.current[0]).toBeUndefined());
    });

    it("applies chained functional updates against the latest value", () => {
        const store = createStore();
        const { result } = renderHook(() => useUpstream<number>("counter", 0, { store }));

        act(() => {
            result.current[1](n => (n ?? 0) + 1);
            result.current[1](n => (n ?? 0) + 1);
        });
        expect(result.current[0]).toBe(2);
    });

    it("propagates parent updates to hooks bound to a child store", () => {
        const parent = createStore();
        const child = divergeStore(parent);
        parent.set("shared", 1);

        const { result } = renderHook(() => useUpstream<number>("shared", { store: child }));
        expect(result.current[0]).toBe(1);

        act(() => { parent.set("shared", 2); });
        expect(result.current[0]).toBe(2);
    });

    it("keeps a diverged override when the parent changes", () => {
        const parent = createStore();
        const child = divergeStore(parent);
        parent.set("k", "parent");
        child.set("k", "child");

        parent.set("k", "parent-2");
        expect(child.get("k")).toBe("child");
    });

    it("resets the value when the key changes", () => {
        const store = createStore();
        store.set("a", "A");
        const { result, rerender } = renderHook(
            ({ k }) => useUpstream<string>(k, { store }),
            { initialProps: { k: "a" } }
        );
        expect(result.current[0]).toBe("A");

        rerender({ k: "b" });
        expect(result.current[0]).toBeUndefined();
    });

    it("useUpstreamRoot keeps a stable hook order across renders", () => {
        const { result, rerender } = renderHook(() => useUpstreamRoot("rootKey", "v"));
        rerender();
        rerender();
        expect(result.current[0]).toBe("v");
    });

    it("gives distinct keys to distinct non-plain objects", () => {
        const a = new Map();
        const b = new Map();
        expect(stableStringify("ctx", a)).not.toBe(stableStringify("ctx", b));
    });

    it("uses plain string keys so store.set and useUpstream agree", () => {
        const store = createStore();
        store.set("theme", "dark");
        const { result } = renderHook(() => useUpstream("theme", { store }));
        expect(result.current[0]).toBe("dark");
    });

    it("does not leave isFetching stuck for deduplicated hooks", async () => {
        const store = createStore();
        let resolve!: (v: string) => void;
        const fetcher = jest.fn(() => new Promise<string>(r => { resolve = r; }));

        const a = renderHook(() => useUpstream("dedupe", fetcher, { store }));
        const b = renderHook(() => useUpstream("dedupe", fetcher, { store }));

        expect(fetcher).toHaveBeenCalledTimes(1);
        await act(async () => resolve("done"));

        await waitFor(() => {
            expect(a.result.current[2].isFetching).toBe(false);
            expect(b.result.current[2].isFetching).toBe(false);
        });
        expect(b.result.current[0]).toBe("done");
    });

    it("retries failed fetches the configured number of times and clears the error", async () => {
        const store = createStore();
        const fetcher = jest.fn()
            .mockRejectedValueOnce(new Error("1"))
            .mockRejectedValueOnce(new Error("2"))
            .mockResolvedValue("ok");

        const { result } = renderHook(() =>
            useUpstream("retry", fetcher, { store, errorRetries: 2, errorRetryInterval: 1 })
        );

        await waitFor(() => expect(result.current[0]).toBe("ok"));
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(result.current[2].error).toBeUndefined();
    });

    it("does not register the same child twice when re-parenting", () => {
        const parent = createStore() as any;
        const child = createStore({ parent }) as any;
        child.parent = parent;
        expect(parent.children.filter((c: any) => c === child)).toHaveLength(1);
    });

    it("detaches useStore stores from their parent on unmount", () => {
        const parent = createStore() as any;
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <UpstreamProvider config={{ store: parent }}>{children}</UpstreamProvider>
        );
        const { unmount } = renderHook(() => useStore({ name: "scoped" }), { wrapper });
        expect(parent.children).toHaveLength(1);
        unmount();
        expect(parent.children).toHaveLength(0);
    });

    it("does not let an undefined config value override the provider store", () => {
        const store = createStore();
        store.set("scoped", "yes");
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <UpstreamProvider config={{ store }}>{children}</UpstreamProvider>
        );
        const { result } = renderHook(
            () => useUpstream("scoped", { store: undefined, refetchOnMount: false }),
            { wrapper }
        );
        expect(result.current[0]).toBe("yes");
    });

    it("restores config from serialized state", () => {
        const original = createStore({ name: "s", syncUp: false });
        original.set("k", 1);
        const restored = createStore({ initialState: original.serialize() });
        expect(restored.config.syncUp).toBe(false);
        expect(restored.get("k")).toBe(1);
    });
});
