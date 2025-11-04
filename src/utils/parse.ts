import { isConfiguration, isFunction } from "./helpers";
import type { Fetcher, Key, UpstreamConfig } from "../types";
import { stableStringify } from "./hash";

export function parseKey(contextUUID: string, key: Key): [string, Key] {
    try {
        key = isFunction(key) ? key() : key;
    } catch (e) {
        key = "";
    }

    if ((Array.isArray(key) && key.length === 0) || !key) return ["", key];

    return [stableStringify(contextUUID, key), key];
}

export function parseArgs<T = any>(args: (Key | T | UpstreamConfig | Fetcher<T>)[]) {
    const result: { 
        key?: Key, 
        initialValue?: T, 
        fetcher?: Fetcher<T>, 
        config?: UpstreamConfig
    } = {};

    for(let i=0;i<args.length;i++) {
        const arg = args[i];

        if(i === 0) {
            result.key = arg as Key;
            continue;
        }

        if(isConfiguration(arg)) {
            result.config = arg as UpstreamConfig;
        }else if(isFunction(arg)) {
            result.fetcher = arg as Fetcher<T>;
        }else {
            result.initialValue = arg as T;
        }
    }

    return result;
}