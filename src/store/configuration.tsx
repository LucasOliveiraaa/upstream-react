"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { UpstreamConfig } from "../types";
import { isFunction } from "../utils/helpers";
import { globalStore } from "./globalStore";

export const UpstreamProviderContext = createContext<UpstreamConfig>({ store: globalStore });

export interface UpstreamProviderProps {
    config: UpstreamConfig | ((parent: UpstreamConfig | undefined) => UpstreamConfig),
    children: React.ReactNode
}

const merge = (a: any, b?: any) => ({ ...a, ...b });

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

export function useUpstreamConfig(_config?: UpstreamConfig) {
    const parentConfig = useContext(UpstreamProviderContext);

    const config = useMemo<UpstreamConfig>(
        () => merge(parentConfig, _config),
        [parentConfig, _config]
    );

    if (!config.store)
        config.store = globalStore;

    return config;
}