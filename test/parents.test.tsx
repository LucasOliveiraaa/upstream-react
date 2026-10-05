import React from "react";
import { renderHook, act } from "@testing-library/react";
import useUpstream, { createStore, divergeStore, useStore, UpstreamProvider } from "../src";

const setup = (config = {}) => {
    const global = createStore({ name: "Global" });
    const user = createStore({ name: "User" });
    const protectedStore = createStore({ name: "Protected", parents: [global, user], ...config });
    return { global, user, protectedStore };
}

describe("lookup parents", () => {
    it("reads keys from every lookup parent, in order", () => {
        const { global, user, protectedStore } = setup();
        global.set("theme", "dark");
        global.set("name", "from-global");
        user.set("name", "Ada");
        user.set("email", "ada@example.com");

        expect(protectedStore.get("theme")).toBe("dark");
        expect(protectedStore.get("email")).toBe("ada@example.com");
        // First parent wins
        expect(protectedStore.get("name")).toBe("from-global");
    });

    it("never writes to lookup parents", () => {
        const { global, user, protectedStore } = setup();
        user.set("name", "Ada");

        protectedStore.set("role", "admin");
        protectedStore.set("name", "Override");

        expect(protectedStore.get("name")).toBe("Override");
        expect(user.get("name")).toBe("Ada");
        expect(global.get("role")).toBeUndefined();
        expect(user.get("role")).toBeUndefined();
    });

    it("isn't a child of its lookup parents", () => {
        const { global, user, protectedStore } = setup();
        expect((global as any).children).not.toContain(protectedStore);
        expect((user as any).children).not.toContain(protectedStore);
        expect(protectedStore.parent).toBeUndefined();

        const seen = jest.fn();
        protectedStore.observeWave(seen);
        global.wave("ping", null);
        expect(seen).not.toHaveBeenCalled();
    });

    it("re-renders hooks when a looked-up value changes", () => {
        const { user, protectedStore } = setup();
        user.set("name", "Ada");

        const { result } = renderHook(() => useUpstream("name", { store: protectedStore }));
        expect(result.current[0]).toBe("Ada");

        act(() => { user.set("name", "Grace"); });
        expect(result.current[0]).toBe("Grace");

        act(() => { user.delete("name"); });
        expect(result.current[0]).toBeUndefined();
    });

    it("ignores changes shadowed by a higher priority source", () => {
        const { global, user, protectedStore } = setup();
        global.set("name", "global");
        const cb = jest.fn();
        protectedStore.subscribe("name", cb);

        user.set("name", "user");
        expect(cb).not.toHaveBeenCalled();

        // Removing the winner reveals the next source
        global.delete("name");
        expect(cb).toHaveBeenLastCalledWith("user", "global");
    });

    it("ignores parent changes for keys it owns, and reveals them when deleted", () => {
        const { user, protectedStore } = setup();
        user.set("name", "Ada");
        protectedStore.set("name", "local");
        const cb = jest.fn();
        protectedStore.subscribe("name", cb);

        user.set("name", "Grace");
        expect(cb).not.toHaveBeenCalled();

        protectedStore.delete("name");
        expect(cb).toHaveBeenLastCalledWith("Grace", "local");
        expect(protectedStore.get("name")).toBe("Grace");
    });

    it("snapshots looked-up values when syncWithParents is false", () => {
        const { user, protectedStore } = setup({ syncWithParents: false });
        user.set("name", "Ada");
        const cb = jest.fn();
        protectedStore.subscribe("name", cb);

        expect(protectedStore.get("name")).toBe("Ada");
        user.set("name", "Grace");

        expect(protectedStore.get("name")).toBe("Ada");
        expect(cb).not.toHaveBeenCalled();
        expect(user.get("name")).toBe("Grace");
    });

    it("doesn't search parents when lookupParents is false", () => {
        const { user, protectedStore } = setup({ lookupParents: false });
        user.set("name", "Ada");
        expect(protectedStore.get("name")).toBeUndefined();
    });

    it("checks the hierarchical parent before lookup parents", () => {
        const app = createStore({ name: "App" });
        const lookup = createStore({ name: "Lookup" });
        const store = createStore({ parent: app, parents: [lookup] });
        app.set("k", "parent");
        lookup.set("k", "lookup");
        lookup.set("only", "lookup");

        expect(store.get("k")).toBe("parent");
        expect(store.get("only")).toBe("lookup");

        const cb = jest.fn();
        store.subscribe("k", cb);
        app.delete("k");
        expect(cb).toHaveBeenLastCalledWith("lookup", "parent");
    });

    it("works through chains of lookup parents", () => {
        const a = createStore();
        const b = createStore({ parents: [a] });
        const c = createStore({ parents: [b] });
        const cb = jest.fn();
        c.subscribe("k", cb);

        a.set("k", 1);
        expect(c.get("k")).toBe(1);
        expect(cb).toHaveBeenCalledWith(1, undefined);
    });

    it("lets diverged and isolated stores use lookup parents", () => {
        const source = createStore();
        source.set("k", "v");
        const isolated = createStore({ isolate: true, parents: [source] });
        const diverged = divergeStore(createStore(), { parents: [source] });

        expect(isolated.get("k")).toBe("v");
        expect(diverged.get("k")).toBe("v");
    });

    it("rejects lookup cycles", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => { });
        const a = createStore();
        const b = createStore({ parents: [a] });
        a.parents = [b, a];
        expect(a.parents).toEqual([]);
        expect(a.get("missing")).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    it("stops observing parents when disposed", () => {
        const { user, protectedStore } = setup();
        const cb = jest.fn();
        protectedStore.subscribe("name", cb);

        protectedStore.dispose();
        user.set("name", "Ada");
        expect(cb).not.toHaveBeenCalled();

        protectedStore.attach();
        user.set("name", "Grace");
        expect(cb).toHaveBeenCalledWith("Grace", "Ada");
    });

    it("useStore with parents doesn't attach to the provider's store", () => {
        const global = createStore() as any;
        const user = createStore();
        user.set("name", "Ada");
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <UpstreamProvider config={{ store: global }}>{children}</UpstreamProvider>
        );

        const { result } = renderHook(() => {
            const store = useStore({ name: "Protected", parents: [global, user] });
            return { store, name: useUpstream("name", { store })[0] };
        }, { wrapper });

        expect(result.current.store.parent).toBeUndefined();
        expect(global.children).toHaveLength(0);
        expect(result.current.name).toBe("Ada");

        act(() => { user.set("name", "Grace"); });
        expect(result.current.name).toBe("Grace");
    });

    it("finds identity keys in parents", () => {
        const parent = createStore();
        const child = createStore({ parents: [parent] });
        const key = new Map();

        renderHook(() => useUpstream(key, "v", { store: parent }));
        const { result } = renderHook(() => useUpstream(key, { store: child }));
        expect(result.current[0]).toBe("v");
    });
});
