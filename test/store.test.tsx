import React, { StrictMode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import useUpstream, {
    createStore,
    createStoreFromStorage,
    divergeStore,
    useStore,
    useUpstreamPersistent,
    UpstreamProvider,
} from "../src";

describe("store", () => {
    it("blocking a wave on one child doesn't block its siblings' subtrees", () => {
        const root = createStore();
        const a = createStore({ parent: root });
        const b = createStore({ parent: root });
        const bChild = createStore({ parent: b });

        a.observeWave(w => { w.blockWave = true; });
        const seen = jest.fn();
        bChild.observeWave(seen);

        root.wave("ping", 1);
        expect(seen).toHaveBeenCalledWith(expect.objectContaining({ type: "ping", payload: 1 }));
    });

    it("ignores deleting an inherited key on a diverged store", () => {
        const parent = createStore();
        const child = divergeStore(parent);
        parent.set("k", 1);
        const cb = jest.fn();
        child.subscribe("k", cb);

        child.delete("k");
        expect(child.get("k")).toBe(1);
        expect(parent.get("k")).toBe(1);
        expect(cb).not.toHaveBeenCalled();
    });

    it("setAndDontNotify doesn't notify anyone", () => {
        const parent = createStore();
        const child = createStore({ parent });
        const cb = jest.fn();
        parent.subscribe("k", cb);
        child.subscribe("k", cb);

        child.setAndDontNotify("k", 1);
        expect(parent.get("k")).toBe(1);
        expect(cb).not.toHaveBeenCalled();
    });

    it("rejects cycles and self-parenting", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => { });
        const a = createStore() as any;
        const b = createStore({ parent: a }) as any;
        a.parent = b;
        a.parent = a;
        expect(a.parent).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    it("storage stores tolerate foreign values and stay stable across reads", () => {
        localStorage.setItem("raw", "not json");
        localStorage.setItem("obj", JSON.stringify({ a: 1 }));
        const store = createStoreFromStorage(localStorage, { name: "ls" });

        expect(store.name).toBe("ls");
        expect(store.get("raw")).toBe("not json");
        expect(store.get("obj")).toBe(store.get("obj"));

        store.set("undef", undefined);
        expect(localStorage.getItem("undef")).toBeNull();
        localStorage.clear();
    });

    it("storage stores pick up changes from other tabs", () => {
        const store = createStoreFromStorage(localStorage);
        const cb = jest.fn();
        store.subscribe("tab", cb);

        localStorage.setItem("tab", "\"other\"");
        window.dispatchEvent(new StorageEvent("storage", {
            key: "tab", newValue: "\"other\"", oldValue: null, storageArea: localStorage,
        }));

        expect(cb).toHaveBeenCalledWith("other", undefined);
        store.dispose();
        localStorage.clear();
    });

    it("in-memory stores ignore storage events", () => {
        const store = createStore();
        window.dispatchEvent(new StorageEvent("storage", {
            key: "leak", newValue: "1", storageArea: localStorage,
        }));
        expect(store.get("leak")).toBeUndefined();
    });
});

describe("hooks", () => {
    it("useUpstreamPersistent reports fromPersistentStore", () => {
        const { result } = renderHook(() => useUpstreamPersistent("persisted", "v"));
        expect(result.current[0]).toBe("v");
        expect(result.current[2].fromPersistentStore).toBe(true);
        expect(localStorage.getItem("persisted")).toBe("\"v\"");
        localStorage.clear();
    });

    it("useStore survives StrictMode double effects", () => {
        const parent = createStore() as any;
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StrictMode>
                <UpstreamProvider config={{ store: parent }}>{children}</UpstreamProvider>
            </StrictMode>
        );
        const { result } = renderHook(() => useStore(), { wrapper });
        expect(parent.children).toEqual([result.current]);
    });

    it("refetches on focus by default", async () => {
        const store = createStore();
        const fetcher = jest.fn().mockResolvedValue("v");
        renderHook(() => useUpstream("focus", fetcher, { store, dedupeTimeSpan: 0 }));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

        await act(async () => { window.dispatchEvent(new Event("focus")); });
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    });

    it("fetches even when an initial value is given", async () => {
        const store = createStore();
        const fetcher = jest.fn().mockResolvedValue("fetched");
        const { result } = renderHook(() => useUpstream("withFallback", "initial", { store, fetcher }));
        expect(result.current[0]).toBe("initial");
        await waitFor(() => expect(result.current[0]).toBe("fetched"));
    });

    it("does nothing for a falsy key", () => {
        const fetcher = jest.fn();
        const { result } = renderHook(() => useUpstream(null, fetcher));
        expect(result.current[0]).toBeUndefined();
        expect(result.current[2].isFetching).toBe(false);
        expect(fetcher).not.toHaveBeenCalled();
    });
});
