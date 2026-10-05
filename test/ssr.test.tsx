/**
 * @jest-environment node
 */
import React from "react";
import { renderToString } from "react-dom/server";
import useUpstream, { createStore, globalStore, useUpstreamPersistent, UpstreamProvider } from "../src";

describe("server rendering", () => {
    it("renders fallbacks without touching the global store", () => {
        function App() {
            const [a] = useUpstream("a", "fallback");
            const [theme] = useUpstreamPersistent("theme", "light");
            const [, , meta] = useUpstream("f", () => Promise.resolve(1));
            return <p>{a}|{theme}|{String(meta.isFetching)}</p>;
        }

        expect(renderToString(<App />)).toBe("<p>fallback<!-- -->|<!-- -->light<!-- -->|<!-- -->true</p>");
        expect([...(globalStore as any).provider.keys()]).toEqual([]);
    });

    it("renders values from a per-request store", () => {
        const store = createStore();
        store.set("user", "Ada");
        function User() {
            return <p>{useUpstream("user")[0]}</p>;
        }

        const html = renderToString(
            <UpstreamProvider config={{ store }}><User /></UpstreamProvider>
        );
        expect(html).toBe("<p>Ada</p>");
    });

    it("warns once when the global store is written on the server", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => { });
        globalStore.set("leak", 1);
        globalStore.set("leak2", 2);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("shared by every request");
        warn.mockRestore();
    });
});
