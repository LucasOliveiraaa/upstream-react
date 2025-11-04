import { renderHook, act, waitFor } from "@testing-library/react";
import useUpstream, { createStore, divergeStore } from "../src";

describe("useUpstream", () => {
    it("returns initial value and updates via setValue", async () => {
        const { result } = renderHook(() => useUpstream("value", "init"));

        let [value] = result.current;
        expect(value).toBe("init");

        act(() => {
            const [, setValue] = result.current;
            setValue("mutated");
        });

        await waitFor(() => {
            const [updatedValue] = result.current;
            expect(updatedValue).toBe("mutated");
        });
    });

    it("supports async fetcher function", async () => {
        const fetcher = jest.fn().mockResolvedValue("fetched");
        const { result } = renderHook(() => useUpstream("fetchKey", fetcher));

        // Initially value is undefined
        let [value, , meta] = result.current;
        expect(value).toBeUndefined();
        expect(meta.isInitial).toBe(true);

        // Wait until first fetch completes
        await waitFor(() => {
            const [, , meta] = result.current;
            return !meta.isInitial;
        });

        const [fetchedValue, , finalMeta] = result.current;
        expect(fetchedValue).toBe("fetched");
        expect(finalMeta.isFetching).toBe(false);

        expect(fetcher).toHaveBeenCalledWith("fetchKey");
    });

    it("handles fetcher errors correctly", async () => {
        const error = new Error("fetch failed");
        const fetcher = jest.fn().mockRejectedValue(error);
        const onError = jest.fn();

        const { result } = renderHook(() =>
            useUpstream("errorKey", fetcher, { onError })
        );

        // Wait until first fetch completes
        await waitFor(() => {
            const [, , meta] = result.current;
            return !meta.isInitial;
        });

        const [, , meta] = result.current;
        expect(meta.error).toBe(error);
        expect(meta.isFetching).toBe(false);

        expect(onError).toHaveBeenCalledWith(error, '"errorKey"');
    });

    it("can use a custom store", async () => {
        const customStore = createStore({ name: "custom" });
        const { result } = renderHook(() =>
            useUpstream("storeKey", "storeInit", { store: customStore })
        );

        const [value] = result.current;
        expect(value).toBe("storeInit");

        act(() => {
            const [, setValue] = result.current;
            setValue("newStoreValue");
        });

        await waitFor(() => {
            const [updatedValue] = result.current;
            expect(updatedValue).toBe("newStoreValue");
        });
    });

    it("supports diverged stores", async () => {
        const baseStore = createStore({ name: "base" });
        baseStore.setAndDontNotify('"key1"', "baseValue");

        const diverged = divergeStore(baseStore);
        const { result } = renderHook(() =>
            useUpstream<string>("key1", { store: diverged })
        );

        const [value] = result.current;
        expect(value).toBe("baseValue");

        act(() => {
            const [, setValue] = result.current;
            setValue("divergedValue");
        });

        await waitFor(() => {
            const [updatedValue] = result.current;
            expect(updatedValue).toBe("divergedValue");
        });

        // parent store remains unchanged
        expect(baseStore.get('"key1"')).toBe("baseValue");
    });

    it("refetches using refetch function", async () => {
        let count = 0;
        const fetcher = jest.fn().mockImplementation(() => {
            count++;
            return Promise.resolve(`value${count}`);
        });

        const { result } = renderHook(() => useUpstream("refetchKey", fetcher));

        // Wait for initial fetch
        await waitFor(() => {
            const [, , meta] = result.current;
            return !meta.isInitial
        });

        const [value] = result.current;
        expect(value).toBe("value1");

        // Trigger refetch
        act(() => {
            const [, , { refetch }] = result.current;
            refetch();
        });

        await waitFor(() => {
            const [value] = result.current;
            expect(value).toBe("value2");
        });
    });
});
