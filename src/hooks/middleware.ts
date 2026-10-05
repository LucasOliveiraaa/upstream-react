"use client";

import type { Key, Fetcher, FetchedData, TransformConfig, UpstreamConfig, UpstreamResponse } from "../core/types";
import { parseArgs } from "../core";
import { useUpstreamHook } from "./useUpstream";

type PriorConfig = UpstreamConfig | ((config: UpstreamConfig | undefined) => UpstreamConfig);

export interface MiddlewareHook {
    <R, T, E = any>(key: Key, fetcher: Fetcher<R>, config: TransformConfig<T, E, R>): UpstreamResponse<T, E>,
    // Same overloads, in the same order, as `UpstreamHook` (see there for why)
    <F extends Fetcher<any>, E = any>(key: Key, fetcher: F, config?: UpstreamConfig<FetchedData<F>, E>): UpstreamResponse<FetchedData<F>, E>,
    <T = any, E = any>(key: Key): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, fetcher: Fetcher<T>, config?: UpstreamConfig<T, E>): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, config: UpstreamConfig<T, E>): UpstreamResponse<T, E>,
    <T = any, E = any>(key: Key, initialValue: T, config?: UpstreamConfig<T, E>): UpstreamResponse<T, E>,
}

/**
 * Creates a hook with the same signature as {@link useUpstream}, but whose
 * config is overridden by `priorConfig`.
 *
 * When `priorConfig` is a function it is called on every render, so it may
 * call other hooks (it must call the same hooks every time).
 */
export const hookMiddleware = (priorConfig: PriorConfig): MiddlewareHook =>
    ((...args: any[]) => {
        const { key, initialValue, fetcher, config } = parseArgs(args);

        // Never reassign `priorConfig`: it's shared by every caller of this hook.
        const resolvedPrior = typeof priorConfig === "function" ? priorConfig(config) : priorConfig;

        return useUpstreamHook(key!, initialValue, fetcher, { ...config, ...resolvedPrior });
    }) as MiddlewareHook;
