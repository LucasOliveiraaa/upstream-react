"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { UpstreamConfig } from "../core/types";
import { globalStore, isFunction } from "../core";

export const UpstreamProviderContext = createContext<UpstreamConfig>({ store: globalStore });

export interface UpstreamProviderProps {
    config: UpstreamConfig | ((parent: UpstreamConfig | undefined) => UpstreamConfig),
    children: React.ReactNode
}

// `undefined` values never override, so `{ store: undefined }` keeps the parent's store
const merge = (a: any, b?: any) => {
    const result = { ...a };
    for (const key in b) {
        if (b[key] !== undefined) result[key] = b[key];
    }
    return result;
};

export function UpstreamProvider({ config: _config, children }: UpstreamProviderProps) {
    const parentConfig = useContext(UpstreamProviderContext);

    const config = useMemo(
        () => merge(parentConfig, isFunction(_config) ? _config(parentConfig) : _config),
        [_config, parentConfig]
    );

    if (!config.store)
        config.store = globalStore;

    return <UpstreamProviderContext.Provider value={config}>
        {children}
    </UpstreamProviderContext.Provider>
}

export function useUpstreamConfig(_config?: UpstreamConfig): UpstreamConfig {
    const parentConfig = useContext(UpstreamProviderContext);

    const config = useMemo<UpstreamConfig>(
        () => merge(parentConfig, _config),
        [parentConfig, _config]
    );

    if (!config.store)
        config.store = globalStore;

    return config;
}