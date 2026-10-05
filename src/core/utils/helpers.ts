import type { UpstreamConfig, HierarchicalStore } from "../types";

export const isWindowDefined = typeof window != "undefined";
export const isDocumentDefined = typeof document != "undefined";

export const isUndefined = (v: unknown): v is undefined => v === undefined;
export const isNull = (v: unknown): v is null => v === null;
export const isFunction = (v: unknown): v is (...args: any[]) => any => typeof v === "function";

// Keep in sync with `UpstreamConfig`. Typed so adding a key that doesn't exist fails to compile.
const CONFIG_KEYS: readonly (keyof UpstreamConfig)[] = [
    "store",
    "initialValue",
    "refetchWhenHidden",
    "refetchWhenOffline",
    "fetcher",
    "transform",
    "onSuccess",
    "onWait",
    "errorRetries",
    "errorRetryInterval",
    "onError",
    "onErrorRetry",
    "fetchTimeout",
    "loadingSlowTimeout",
    "onLoadingSlow",
    "dedupeTimeSpan",
    "refetchInterval",
    "refetchOnFocus",
    "refetchOnReconnect",
    "refetchOnMount",
    "refetchWhenStale",
    "staleTimeSpan",
];

export const isConfiguration = (value: any): value is UpstreamConfig => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        CONFIG_KEYS.some(key => key in value)
    );
}

export const isHierarchicalStore = (value: any): value is HierarchicalStore => {
    return (
        typeof value === "object" &&
        value !== null &&
        value.upstreamUUIDs instanceof Set &&
        "children" in value &&
        Array.isArray(value.children)
    )
}

const getType = (v: any) => Object.prototype.toString.call(v);
const isType = (type: string, target: string) => type === `[object ${target}]`

export const clone = (value: any): any => {
    const typeName = getType(value);
    const isObject = isType(typeName, "Object");

    if (Object(value) === value) {
        if (Array.isArray(value)) {
            const result = []
            for (const v of value) {
                result.push(clone(v));
            }
            return result;
        }

        if (isObject) {
            const result: { [key: string]: any } = {}
            for (const v in value) {
                result[v] = clone(value[v]);
            }
            return result;
        }
    }

    return value;
}