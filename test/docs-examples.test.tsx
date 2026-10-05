/**
 * The examples from docs/, run as written. If one of these fails, the docs
 * are wrong: fix the docs along with the code.
 */
import { renderHook } from "@testing-library/react";
import useUpstream, { createStore, globalStore, mutate } from "../src";

describe("docs/synchronization.md", () => {
    it("hierarchies: a child mirrors its parent", () => {
        const app = createStore({ name: "App" });
        const page = createStore({ name: "Page", parent: app });

        app.set("theme", "dark");
        expect(page.get("theme")).toBe("dark");

        page.set("theme", "light");
        expect(app.get("theme")).toBe("light");

        app.set("theme", "blue");
        expect(page.get("theme")).toBe("blue");
    });

    it("diverging", () => {
        const base = createStore({ name: "Base" });
        const preview = base.diverge({ name: "Preview" });

        base.set("color", "red");
        base.set("size", "M");

        preview.set("color", "blue");
        expect(preview.get("color")).toBe("blue");
        expect(base.get("color")).toBe("red");

        base.set("size", "L");
        expect(preview.get("size")).toBe("L");

        base.set("color", "green");
        expect(preview.get("color")).toBe("blue");

        preview.delete("color");
        expect(preview.get("color")).toBe("green");
    });

    it("lookup parents", () => {
        const userStore = createStore({ name: "User" });
        const dashboardStore = createStore({
            name: "Dashboard",
            parents: [globalStore, userStore],
        });

        globalStore.set("locale", "en");
        userStore.set("name", "Ada");

        expect(dashboardStore.get("locale")).toBe("en");
        expect(dashboardStore.get("name")).toBe("Ada");

        dashboardStore.set("role", "admin");
        expect(userStore.get("role")).toBeUndefined();

        dashboardStore.set("name", "Ada (admin)");
        expect(dashboardStore.get("name")).toBe("Ada (admin)");
        expect(userStore.get("name")).toBe("Ada");

        globalStore.delete("locale");
    });

    it("lookup order: own → parent → parents", () => {
        const app = createStore();
        const defaults = createStore();
        const fallbacks = createStore();
        const store = createStore({ parent: app, parents: [defaults, fallbacks] });

        fallbacks.set("k", "fallbacks");
        expect(store.get("k")).toBe("fallbacks");
        defaults.set("k", "defaults");
        expect(store.get("k")).toBe("defaults");
        app.set("k", "app");
        expect(store.get("k")).toBe("app");
    });

    it("snapshot mode", () => {
        const profileStore = createStore();
        profileStore.set("email", "old@example.com");
        const formStore = createStore({ parents: [profileStore], syncWithParents: false });

        expect(formStore.get("email")).toBe("old@example.com");
        profileStore.set("email", "new@example.com");
        expect(formStore.get("email")).toBe("old@example.com");
    });

    it("waves: blocking one branch", () => {
        const app = createStore();
        const sandbox = createStore({ parent: app });
        const sandboxChild = createStore({ parent: sandbox });
        const sibling = createStore({ parent: app });

        sandbox.observeWave(wave => { wave.blockWave = true; });
        const sandboxSeen = jest.fn();
        const childSeen = jest.fn();
        const siblingSeen = jest.fn();
        sandbox.observeWave(sandboxSeen);
        sandboxChild.observeWave(childSeen);
        sibling.observeWave(siblingSeen);

        app.wave("logout", { reason: "expired" });
        expect(sandboxSeen).toHaveBeenCalledWith(
            expect.objectContaining({ type: "logout", payload: { reason: "expired" }, source: app })
        );
        expect(childSeen).not.toHaveBeenCalled();
        expect(siblingSeen).toHaveBeenCalled();
    });
});

describe("docs/stores.md", () => {
    it("get vs has, and string keys shared with hooks", () => {
        const parent = createStore();
        const cartStore = createStore({ parent });
        parent.set("items", ["apple"]);

        expect(cartStore.get("items")).toEqual(["apple"]);
        expect(cartStore.has("items")).toBe(false);

        const { result } = renderHook(() => useUpstream("items", { store: cartStore }));
        expect(result.current[0]).toEqual(["apple"]);
    });

    it("set returns the previous value", () => {
        const store = createStore();
        store.set("k", 1);
        expect(store.set("k", 2)).toBe(1);
    });

    it("clone is independent and deep", () => {
        const store = createStore({ name: "S" });
        store.set("list", [{ a: 1 }]);
        const copy = store.clone();

        expect(copy.get("list")).toEqual([{ a: 1 }]);
        expect(copy.get("list")).not.toBe(store.get("list"));
        copy.set("list", []);
        expect(store.get("list")).toEqual([{ a: 1 }]);
    });

    it("serialize drops functions and round-trips values", () => {
        const store = createStore({ name: "S", onChange: () => { } });
        store.set("k", { nested: true });
        const restored = createStore({ initialState: store.serialize() });

        expect(restored.get("k")).toEqual({ nested: true });
        expect(restored.name).toBe("S");
        expect(restored.config.onChange).toBeUndefined();
    });
});

describe("docs/core-concepts.md and docs/mutations.md", () => {
    it("dependent keys: a function key returning undefined is disabled", () => {
        const store = createStore();
        const fetchPosts = jest.fn();
        const user = undefined as { id: number } | undefined;

        const { result } = renderHook(() =>
            useUpstream(() => user && ["/api/posts", user.id], fetchPosts, { store })
        );
        expect(result.current[0]).toBeUndefined();
        expect(fetchPosts).not.toHaveBeenCalled();
    });

    it("mutate accepts array keys, same as the hook", async () => {
        const store = createStore();
        const { result } = renderHook(() => useUpstream(["/api/users", 42], { store }));

        await mutate(["/api/users", 42], { name: "Ada" }, { store });
        expect(result.current[0]).toEqual({ name: "Ada" });
    });

    it("keeps optimistic data when rollbackOnError is false", async () => {
        const store = createStore({ initialValues: { k: "before" } });
        await mutate("k", Promise.reject(new Error("x")), {
            store, optimisticData: "optimistic", rollbackOnError: false,
        }).catch(() => { });
        expect(store.get("k")).toBe("optimistic");
    });
});
