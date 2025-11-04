import type { Key, Fetcher, UpstreamConfig } from "../types";
import { isConfiguration, isFunction } from "../utils/helpers";
import { useUpstream } from "./useUpstream";

export const hookMiddleware = (priorConfig: UpstreamConfig | ((config: UpstreamConfig | undefined) => UpstreamConfig)) =>
    <T = any, E = any>(
        _key: Key,
        _ivOrFeOrCo?: T | Fetcher<T> | UpstreamConfig,
        _config?: UpstreamConfig
    ) => {
        // Determine which argument type we're actually dealing with
        let initialValue: T | undefined = undefined;
        let fetcher: Fetcher<T> | undefined = undefined;
        let config: UpstreamConfig | undefined = _config;

        if (isFunction(_ivOrFeOrCo)) {
            fetcher = _ivOrFeOrCo as Fetcher<T>;
        } else if (isConfiguration(_ivOrFeOrCo)) {
            config = { ...(_ivOrFeOrCo as UpstreamConfig), ..._config };
        } else {
            initialValue = _ivOrFeOrCo as T | undefined;
        }

        if (isFunction(priorConfig)) {
            try { priorConfig = priorConfig(config); }
            catch (err) { priorConfig = {}; }
        }

        if (fetcher) {
            return useUpstream<T, E>(_key, fetcher, { ...config, ...priorConfig });
        } else if (typeof initialValue !== 'undefined') {
            return useUpstream<T, E>(_key, initialValue, { ...config, ...priorConfig });
        } else {
            return useUpstream<T, E>(_key, { ...config, ...priorConfig });
        }
    };