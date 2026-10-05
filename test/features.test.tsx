import { renderHook, act, waitFor } from "@testing-library/react";
import useUpstream, { createStore, createStoreFromStorage, mutate } from "../src";

describe("fetching", () => {
    it("passes an AbortSignal and times out with fetchTimeout", async () => {
        const store = createStore();
        let signal: AbortSignal | undefined;
        const fetcher = jest.fn((_key: string, opts: { signal?: AbortSignal }) => {
            signal = opts.signal;
            return new Promise<string>(() => { });
        });
        const onLoadingSlow = jest.fn();

        const { result } = renderHook(() =>
            useUpstream("timeout", fetcher, { store, fetchTimeout: 10, onLoadingSlow })
        );

        await waitFor(() => expect(result.current[2].error).toBeDefined());
        expect((result.current[2].error as Error).name).toBe("TimeoutError");
        expect(signal?.aborted).toBe(true);
        expect(onLoadingSlow).toHaveBeenCalledWith("timeout");
        expect(result.current[2].isFetching).toBe(false);
    });

    it("lets a newer request supersede an older one", async () => {
        const store = createStore();
        const resolvers: ((v: string) => void)[] = [];
        const signals: AbortSignal[] = [];
        const fetcher = (_: string, { signal }: { signal?: AbortSignal }) => {
            signals.push(signal!);
            return new Promise<string>(r => resolvers.push(r));
        };

        const { result } = renderHook(() => useUpstream("race", fetcher, { store, dedupeTimeSpan: 0 }));
        act(() => { result.current[2].refetch(); });

        expect(signals[0].aborted).toBe(true);
        await act(async () => {
            resolvers[1]("new");
            resolvers[0]("old");
        });

        await waitFor(() => expect(result.current[2].isFetching).toBe(false));
        expect(result.current[0]).toBe("new");
        expect(result.current[2].error).toBeUndefined();
    });

    it("transforms data and ignores callback return values", async () => {
        const store = createStore();
        const onSuccess = jest.fn(() => "ignored");
        const { result } = renderHook(() =>
            useUpstream("transform", () => Promise.resolve([1, 2]), {
                store,
                transform: (data: number[]) => data.length,
                onSuccess,
            })
        );

        await waitFor(() => expect(result.current[0]).toBe(2));
        expect(onSuccess).toHaveBeenCalledWith(2, "transform");
    });

    it("doesn't revalidate stale data by default", async () => {
        jest.useFakeTimers();
        const store = createStore();
        const fetcher = jest.fn().mockResolvedValue("v");
        renderHook(() => useUpstream("stale", fetcher, { store }));

        await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
        expect(fetcher).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
});

describe("options object", () => {
    it("accepts initialValue in the config", () => {
        const store = createStore();
        const fn = () => "a function value";
        const { result } = renderHook(() => useUpstream("fnValue", { store, initialValue: fn }));
        expect(result.current[0]).toBe(fn);
    });
});

describe("mutate", () => {
    it("sets, updates and deletes keys outside React", async () => {
        const store = createStore();
        const { result } = renderHook(() => useUpstream<number>("m", { store }));

        await act(() => mutate("m", 1, { store }));
        expect(result.current[0]).toBe(1);

        await act(() => mutate<number>("m", n => (n ?? 0) + 1, { store }));
        expect(result.current[0]).toBe(2);

        await act(() => mutate("m", undefined, { store }));
        expect(result.current[0]).toBeUndefined();
    });

    it("applies optimistic data and rolls back on error", async () => {
        const store = createStore();
        store.set("user", "Ada");
        const { result } = renderHook(() => useUpstream("user", { store }));

        let reject!: (e: Error) => void;
        let pending!: Promise<unknown>;
        act(() => {
            pending = mutate("user", new Promise((_, r) => { reject = r; }), {
                store,
                optimisticData: "Grace",
            }).catch(e => e);
        });
        expect(result.current[0]).toBe("Grace");

        await act(async () => {
            reject(new Error("nope"));
            await pending;
        });
        expect(result.current[0]).toBe("Ada");
    });

    it("revalidates mounted hooks", async () => {
        const store = createStore();
        const fetcher = jest.fn().mockResolvedValueOnce("first").mockResolvedValue("second");
        const { result } = renderHook(() => useUpstream("reval", fetcher, { store, dedupeTimeSpan: 0 }));
        await waitFor(() => expect(result.current[0]).toBe("first"));

        await act(() => mutate("reval", undefined, { store, revalidate: true }));
        await waitFor(() => expect(result.current[0]).toBe("second"));

        // Without data, mutate only revalidates
        fetcher.mockResolvedValue("third");
        await act(() => mutate("reval"));
        expect(result.current[0]).toBe("second"); // global store, not ours
    });
});

describe("storage", () => {
    afterEach(() => localStorage.clear());

    it("scopes keys with a prefix", () => {
        localStorage.setItem("foreign", "1");
        const store = createStoreFromStorage(localStorage, { prefix: "app:" });
        store.set("theme", "dark");

        expect(localStorage.getItem("app:theme")).toBe("\"dark\"");
        expect(JSON.parse(store.serialize()).provider).toEqual({ theme: "dark" });
        store.dispose();
    });

    it("keeps values in memory when storage is full", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => { });
        const full = {
            ...localStorage,
            length: 0,
            key: () => null,
            getItem: () => null,
            removeItem: () => { },
            setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
        } as unknown as Storage;

        const store = createStoreFromStorage(full);
        store.set("big", "value");
        expect(store.get("big")).toBe("value");
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe("initialValues", () => {
    it("seeds a store with plain values readable by hooks", () => {
        const store = createStore({ initialValues: { theme: "dark", "/api/me": { name: "Ada" } } });
        const { result } = renderHook(() => useUpstream<{ name: string }>("/api/me", { store }));
        expect(result.current[0]).toEqual({ name: "Ada" });
        expect(store.get("theme")).toBe("dark");
    });

    it("doesn't write seeded values up to a parent", () => {
        const parent = createStore();
        const child = createStore({ parent, initialValues: { k: 1 } });
        expect(child.get("k")).toBe(1);
        expect(parent.get("k")).toBeUndefined();
    });
});
