import type { UpstreamConfig, EventHandlerCallback, EventTypes } from "../types";

export const isWindowDefined = typeof window != "undefined";
export const isDocumentDefined = typeof document != "undefined";

export const isUndefined = (v: unknown): v is undefined => v === undefined;
export const isNull = (v: unknown): v is null => v === null;
export const isFunction = (v: unknown): v is (...args: any[]) => any => typeof v === "function";

export const isConfiguration = (value: any): value is UpstreamConfig => {
    return (
        typeof value === "object" &&
        value !== null &&
        (
            "store" in value ||
            "refetchWhenHidden" in value ||
            "refetchWhenOffline" in value ||
            "fetcher" in value ||
            "onSuccess" in value ||
            "onWait" in value ||
            "errorRetries" in value ||
            "errorRetryInterval" in value ||
            "onError" in value ||
            "onErrorRetry" in value ||
            "fetchTimeout" in value ||
            "onLoadingSlow" in value ||
            "dedupeTimeSpan" in value ||
            "refetchInterval" in value ||
            "refetchOnFocus" in value ||
            "refetchOnReconnect" in value ||
            "refetchOnMount" in value ||
            "refetchWhenStale" in value ||
            "staleTimeSpan" in value
        )
    );
}

const getType = (v: any) => Object.prototype.toString.call(v);
const isType = (type: string, target: string) => type === `[object ${target}]`

export const clone = (value: any): any => {
    const typeName = getType(value);
    const isObject = isType(typeName, "Object");

    if (Object(value) === value) {
        if (Array.isArray(value)) {
            let result = []
            for (const v of value) {
                result.push(clone(v));
            }
            return result;
        }

        if (isObject) {
            let result: { [key: string]: any } = {}
            for (const v in value) {
                result[v] = clone(value[v]);
            }
            return result;
        }
    }

    return value;
}