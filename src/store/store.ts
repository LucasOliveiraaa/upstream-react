"use client";

import { isNull, isUndefined, clone as cloneValue } from "../utils/helpers";
import type {
    StoreProvider,
    Store,
    StoreConfig,
    EventHandlerCallback,
    MutationObserver,
    Unsubscriber,
    EventTypes,
    ExtendedStoreConfig
} from "../types";
import { generateUUID } from "../utils/hash";

/**
 * Creates a new, empty store
 */
export function createStore(config?: ExtendedStoreConfig) {
    const { name, provider, parent, initialState, ...rest } = config || {};

    if (!isUndefined(initialState)) {
        return BaseStore.deserialize(initialState, config);
    }

    const store = new BaseStore(name || "Unknown Store", provider, parent, rest as StoreConfig);
    return store;
}

/**
 * Diverges a store by cloning it
 */
export function divergeStore(root: Store, config?: ExtendedStoreConfig) {
    return root.diverge(config);
}

export function createStoreFromStorage(storage: Storage, config?: ExtendedStoreConfig): Store {
    const { name, parent, ...rest } = config || {};

    const provider: StoreProvider = {
        get(key: string) {
            const res = storage.getItem(key)
            return isNull(res) ? undefined : JSON.parse(res);
        },
        set(key: string, value: any) {
            const prev = this.get(key);
            storage.setItem(key, JSON.stringify(value));
            return prev;
        },
        delete(key) {
            storage.removeItem(key);
        },
        *keys() {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key !== null) {
                    yield key;
                }
            }
        },
    }

    const store = new BaseStore("Unknown Store", provider, parent, rest as StoreConfig);
    return store;
}

export class BaseStore implements Store {
    handlers: Record<string, EventHandlerCallback[]> = {};
    fetches: Record<string, [any, number]> = {};
    subscribers: Record<string, MutationObserver[]> = {};

    UUID: string;
    name: string;

    provider: StoreProvider;
    config: StoreConfig;
    _parent?: Store;
    children: Store[] = [];

    teardown: (() => void)[] = [];

    get parent(): Store | undefined {
        return this._parent;
    }

    set parent(parent: Store | undefined) {
        if (this.config.isolate) {
            console.warn(`Store ${this.name} is isolated, meaning it can't have a parent.`);
            return;
        }

        if (!isUndefined(parent)) {
            if (parent.config.isolate) {
                console.warn(`Store ${parent.name} is isolated, meaning that it can't be set as parent of store ${this.name}`);
                return;
            }

            if (!isUndefined(this._parent) && parent.UUID !== this._parent?.UUID) {
                this._parent.children = this._parent.children.filter(pred => pred.UUID !== this.UUID);
            }

            parent.children.push(this);
        }

        this._parent = parent;
    }

    constructor(name: string, provider?: StoreProvider, parent?: Store, config?: StoreConfig) {
        this.provider = provider || new Map<string, any>();
        this._parent = parent;
        this.config = config || {};

        this.UUID = generateUUID();
        this.name = name;

        parent?.children.push(this);
    }

    get<T>(key: string): T | undefined {
        let value = this.provider.get(key);

        if (isUndefined(value) && !isUndefined(this.parent) && !this.config?.isolate && (this.config.stayInSync ?? true)) {
            value = this.parent.get<T>(key);

            if (!isUndefined(value) && !this.config.isolate && (this.parent.config.syncDown ?? true))
                this.provider.set(key, value); // Hydratate the store from it's parent
        }

        return value;
    }

    set<T>(key: string, value: T): T | undefined {
        const prev = this.setAndDontNotify<T>(key, value);

        if (!Object.is(value, prev)) {
            this.config.onChange?.(key, value, prev);
            this.subscribers[key]?.forEach(cb => cb(value, prev));
        }

        return prev;
    }

    setAndDontNotify<T>(key: string, value: T): T | undefined {
        let prev = this.provider.get(key);
        if (isUndefined(prev) && !isUndefined(this.parent) && !this.config.isolate && (this.config.stayInSync ?? true)) {
            prev = this.parent.get(key);
        }

        if (Object.is(prev, value)) return value;

        if (!isUndefined(this.parent) && !this.config.isolate && (this.config.syncUp ?? true))
            this.parent.set(key, value); // Maintain parent in sync
        this.provider.set(key, value);

        return prev;
    }

    delete(key: string): void {
        this.provider.delete(key);
    }

    has(key: string): boolean {
        return !isUndefined(this.provider.get(key))
    }

    clone(): Store {
        const clone = new BaseStore(this.name);
        for (const key of this.provider.keys()) {
            clone.set(key, cloneValue(this.provider.get(key)));
        }

        clone.parent = this.parent;
        return clone;
    }

    diverge(config?: ExtendedStoreConfig): Store {
        const { name, provider, parent, ...rest } = config || {};

        const clone = new BaseStore(name ?? this.name, provider, this, { ...rest, syncUp: false });
        return clone;
    }

    subscribe(key: string, callback: MutationObserver): Unsubscriber {
        const subscribers = this.subscribers[key] || [];
        subscribers.push(callback);
        this.subscribers[key] = subscribers;

        return () => {
            this.subscribers[key] = this.subscribers[key].filter(pred => pred != callback);
        };
    }

    subscribeHandler(key: string, handler: EventHandlerCallback): () => void {
        const handlers = this.handlers[key] || [];
        handlers.push(handler);
        this.handlers[key] = handlers;

        return () => {
            this.handlers[key] = this.handlers[key].filter(pred => pred != handler);
        };
    }
    notifyHandlers(key: string, type: EventTypes, ...args: any[]): void {
        this.handlers[key]?.forEach(h => h(type, ...args));
    }

    serialize(): string {
        const providerData: any = {};
        for (const key of this.provider.keys()) {
            providerData[key] = this.provider.get(key);
        }

        const data = {
            UUID: this.UUID,
            name: this.name,
            config: this.config,
            provider: providerData
        };

        return JSON.stringify(data);
    }

    static deserialize(serialized: string, config?: ExtendedStoreConfig): Store {
        const { name, parent, ...rest } = config || {};

        const data = JSON.parse(serialized);

        const provider = new Map<string, any>();
        for (const key in data.provider) {
            provider.set(key, data.provider[key]);
        }

        const store = new BaseStore(name || data.name, provider, parent, rest as StoreConfig);
        store.UUID = data.UUID;

        return store;
    }
}