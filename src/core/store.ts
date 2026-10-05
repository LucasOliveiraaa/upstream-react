import { isNull, isUndefined, clone as cloneValue, isHierarchicalStore } from "./utils/helpers";
import {
    StoreProvider,
    Store,
    StoreConfig,
    EventHandlerCallback,
    MutationObserver,
    StoreObserver,
    Unsubscriber,
    EventTypes,
    ExtendedStoreConfig,
    StorageStoreConfig,
    type Wave,
    type WaveObserver
} from "./types";
import { generateUUID } from "./utils/hash";
import { isVisible, listenForFocus, listenForReconnect, listenForWindowSync } from "./utils/web";

/**
 * Creates a new, empty store
 */
export function createStore(config?: ExtendedStoreConfig): Store {
    const { name, provider, parent, parents, initialState, initialValues, ...rest } = config || {};

    const store = !isUndefined(initialState)
        ? BaseStore.deserialize(initialState, config)
        : new BaseStore(name || "Unknown Store", provider, parent, rest as StoreConfig, parents);

    seed(store as BaseStore, initialValues);

    return store;
}

/**
 * Diverges a store by cloning it
 */
export function divergeStore(root: Store, config?: ExtendedStoreConfig) {
    return root.diverge(config);
}

/**
 * Creates a store backed by a Web `Storage` (e.g. `localStorage`), kept in
 * sync with other tabs writing to the same storage.
 */
export function createStoreFromStorage(storage: Storage, config?: StorageStoreConfig): Store {
    const { name, parent, parents, prefix = "", provider: _, initialState: __, initialValues, ...rest } = config || {};

    // Parsed values are cached by their raw string so repeated reads return
    // the same reference, which React needs to avoid needless re-renders.
    const cache = new Map<string, { raw: string, value: any }>();
    // Values that couldn't be written (quota exceeded, storage disabled...)
    // are kept in memory so the app keeps working for this session.
    const unsaved = new Map<string, any>();

    const read = (key: string): string | null => {
        try { return storage.getItem(prefix + key); }
        catch { return null; }
    }

    const provider: StoreProvider = {
        get(key: string) {
            if (unsaved.has(key)) return unsaved.get(key);

            const raw = read(key);
            if (isNull(raw)) {
                cache.delete(key);
                return undefined;
            }

            const cached = cache.get(key);
            if (cached && cached.raw === raw) return cached.value;

            let value: any;
            try { value = JSON.parse(raw); }
            catch { value = raw; } // Not written by us, expose the raw string

            cache.set(key, { raw, value });
            return value;
        },
        set(key: string, value: any) {
            const prev = this.get(key);
            if (isUndefined(value)) {
                this.delete(key);
                return prev;
            }

            const raw = JSON.stringify(value);
            try {
                storage.setItem(prefix + key, raw);
                unsaved.delete(key);
                cache.set(key, { raw, value });
            } catch (err) {
                console.warn(`Store ${store.name}: couldn't persist "${key}", keeping it in memory only.`, err);
                unsaved.set(key, value);
            }
            return prev;
        },
        delete(key) {
            unsaved.delete(key);
            cache.delete(key);
            try { storage.removeItem(prefix + key); }
            catch { /* nothing to remove */ }
        },
        *keys() {
            const seen = new Set<string>();
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key !== null && key.startsWith(prefix)) {
                    const unprefixed = key.slice(prefix.length);
                    seen.add(unprefixed);
                    yield unprefixed;
                }
            }
            for (const key of unsaved.keys()) {
                if (!seen.has(key)) yield key;
            }
        },
    }

    const store = new BaseStore(name || "Unknown Store", provider, parent, rest as StoreConfig, parents);
    seed(store, initialValues);

    // Keep this store in sync with other tabs writing to the same storage.
    store.teardown.push(listenForWindowSync(storage, (storageKey, _value, prev) => {
        if (!storageKey.startsWith(prefix)) return;

        const key = storageKey.slice(prefix.length);
        cache.delete(key);
        unsaved.delete(key);
        store.notify(key, store.get(key), prev);
    }));

    return store;
}

/**
 * Writes initial values into the store itself only. Stores are often created
 * during render (`useStore`), where writing to parents would change shared
 * state behind React's back.
 */
const seed = (store: BaseStore, values: Record<string, unknown> | undefined) => {
    for (const key in values) {
        if (!isUndefined(values[key])) store.provider.set(key, values[key]);
    }
}

/** Whether `target` can be reached from `from` by following parents */
const reaches = (from: Store, target: Store): boolean => {
    if (from === target) return true;
    if (from.parent && reaches(from.parent, target)) return true;
    return (from.parents || []).some(p => reaches(p, target));
}

export class BaseStore implements Store {
    handlers: Record<string, EventHandlerCallback[]> = {};
    fetches: Record<string, [any, number, AbortController?]> = {};
    subscribers: Record<string, MutationObserver[]> = {};
    observers: StoreObserver[] = [];
    waveObservers: WaveObserver[] = [];

    UUID: string;
    name: string;

    provider: StoreProvider;
    config: StoreConfig;
    _parent?: Store;
    _parents: Store[] = [];
    children: Store[] = [];

    teardown: (() => void)[] = [];
    private eventTeardown?: () => void;
    private lookupTeardown?: () => void;
    // Keys this store is currently writing up to its parent. The parent's
    // push-down for those keys is ignored: this store notifies on its own.
    private writing = new Set<string>();

    get upstreamUUIDs(): Set<string> {
        const uuids = new Set<string>();
        for (let s = this._parent; s; s = s.parent) uuids.add(s.UUID);
        return uuids;
    }

    get parent(): Store | undefined {
        return this._parent;
    }

    set parent(parent: Store | undefined) {
        if (parent === this._parent) {
            this.attach();
            return;
        }

        if (!isUndefined(parent)) {
            if (this.config.isolate) {
                console.warn(`Store ${this.name} is isolated, meaning it can't have a parent.`);
                return;
            }

            if (reaches(parent, this)) {
                console.warn(`Circular store dependency detected when setting parent of store ${this.name} to ${parent.name}. Operation aborted to prevent infinite loops.`)
                return;
            }

            if (parent.config.isolate) {
                console.warn(`Store ${parent.name} is isolated, meaning it can't have children.`);
                return;
            }
        }

        this.detach();
        this._parent = parent;
        this.attach();
    }

    /**
     * Read-only stores searched, in order, for keys this store (and its
     * {@link parent}) doesn't have. This store is never written to them.
     */
    get parents(): Store[] {
        return this._parents.slice();
    }

    set parents(parents: Store[]) {
        const valid: Store[] = [];
        for (const parent of parents) {
            if (reaches(parent, this)) {
                console.warn(`Circular store dependency detected when adding ${parent.name} to the parents of store ${this.name}. Parent ignored to prevent infinite loops.`);
            } else if (!valid.includes(parent)) {
                valid.push(parent);
            }
        }

        this.disconnectLookups();
        this._parents = valid;
        this.connectLookups();
    }

    constructor(name: string, provider?: StoreProvider, parent?: Store, config?: StoreConfig, parents?: Store[]) {
        this.provider = provider || new Map<string, any>();
        this.config = config || {};

        this.UUID = generateUUID();
        this.name = name;

        this.parent = parent;
        if (parents) this.parents = parents;
    }

    /** Whether this store reads keys it doesn't own from its parent */
    private inheritsFromParent(): this is { parent: Store } {
        return !isUndefined(this._parent)
            && !this.config.isolate
            && (this.config.stayInSync ?? true)
            && (this._parent.config.syncDown ?? true);
    }

    private writesToParent(): this is { parent: Store } {
        return !isUndefined(this._parent)
            && !this.config.isolate
            && (this.config.syncUp ?? true);
    }

    private looksUp(): boolean {
        return this._parents.length > 0 && (this.config.lookupParents ?? true);
    }

    private syncsWithParents(): boolean {
        return this.looksUp() && (this.config.syncWithParents ?? true);
    }

    /**
     * Searches the lookup parents, starting at `from`. When not kept in sync,
     * a found value is copied into this store and won't change afterwards.
     */
    private lookup<T>(key: string, from = 0, snapshot = true): T | undefined {
        if (!this.looksUp()) return undefined;

        for (let i = from; i < this._parents.length; i++) {
            const value = this._parents[i].get<T>(key);
            if (!isUndefined(value)) {
                if (snapshot && !this.syncsWithParents()) this.provider.set(key, value);
                return value;
            }
        }
        return undefined;
    }

    get<T>(key: string): T | undefined {
        const value = this.provider.get(key);
        if (!isUndefined(value)) return value;

        if (this.inheritsFromParent()) {
            const inherited = this.parent.get<T>(key);
            if (!isUndefined(inherited)) return inherited;
        }

        return this.lookup<T>(key);
    }

    set<T>(key: string, value: T): T | undefined {
        return this.write(key, value, true);
    }

    setAndDontNotify<T>(key: string, value: T): T | undefined {
        return this.write(key, value, false);
    }

    delete(key: string): void {
        this.write(key, undefined, true);
    }

    has(key: string): boolean {
        return !isUndefined(this.provider.get(key))
    }

    private write<T>(key: string, value: T | undefined, notify: boolean): T | undefined {
        const prev = this.get<T>(key);
        const owned = this.has(key);

        if (Object.is(prev, value) && (owned || isUndefined(value))) return prev;

        // Deleting a key we only inherit: the parent owns it, so either
        // forward the deletion (it'll be pushed back down to us) or ignore it.
        if (isUndefined(value) && !owned) {
            if (this.writesToParent()) {
                if (notify) this.parent.delete(key);
                else this.parent.setAndDontNotify(key, undefined);
            }
            return prev;
        }

        if (isUndefined(value)) this.provider.delete(key);
        else this.provider.set(key, value);

        if (this.writesToParent()) {
            this.writing.add(key);
            try {
                if (notify) this.parent.set(key, value);
                else this.parent.setAndDontNotify(key, value);
            } finally {
                this.writing.delete(key);
            }
        }

        // Removing a local value may reveal an inherited one
        if (notify) this.notify(key, this.get(key), prev);
        return prev;
    }

    /**
     * Notifies this store's observers of a change in `key` and pushes the
     * change down to every child that inherits it.
     */
    notify(key: string, value: any, prev: any): void {
        if (Object.is(value, prev)) return;

        this.config.onChange?.(key, value, prev);
        this.subscribers[key]?.slice().forEach(cb => cb(value, prev));
        this.observers.slice().forEach(cb => cb(key, value, prev));

        for (const child of this.children) {
            if (child instanceof BaseStore) child.receiveFromParent(key, value, prev);
        }
    }

    /**
     * Notifies the change of an inherited key. `prev` is the source's previous
     * value, when it's `undefined` the key previously came from `fallback()`.
     */
    private notifyInherited(key: string, prev: any, fallback: () => any): void {
        this.notify(key, this.get(key), isUndefined(prev) ? fallback() : prev);
    }

    private receiveFromParent(key: string, value: any, prev: any): void {
        if (!this.inheritsFromParent() || this.writing.has(key)) return;

        if (this.has(key)) {
            // A child that writes up is a mirror of its parent, keep it in sync.
            // A diverged child (syncUp: false) keeps its local override.
            if (!this.writesToParent()) return;

            const own = this.provider.get(key);
            if (isUndefined(value)) this.provider.delete(key);
            else this.provider.set(key, value);
            this.notifyInherited(key, own, () => this.lookup(key, 0, false));
            return;
        }

        this.notifyInherited(key, prev, () => this.lookup(key, 0, false));
    }

    private receiveFromLookup(index: number, key: string, prev: any): void {
        if (this.has(key)) return;

        // Shadowed by a source with higher priority
        if (this.inheritsFromParent() && !isUndefined(this.parent.get(key))) return;
        for (let i = 0; i < index; i++) {
            if (!isUndefined(this._parents[i].get(key))) return;
        }

        this.notifyInherited(key, prev, () => this.lookup(key, index + 1, false));
    }

    private connectLookups(): void {
        if (this.lookupTeardown || !this.syncsWithParents()) return;

        const stops = this._parents.map((parent, index) =>
            parent.observe((key, _value, prev) => this.receiveFromLookup(index, key, prev))
        );
        this.lookupTeardown = () => stops.forEach(stop => stop());
    }

    private disconnectLookups(): void {
        this.lookupTeardown?.();
        this.lookupTeardown = undefined;
    }

    observe(observer: StoreObserver): Unsubscriber {
        this.observers.push(observer);

        return () => {
            this.observers = this.observers.filter(pred => pred != observer);
        };
    }

    wave(type: string | Wave, payload?: any): void {
        const base: Wave = typeof type === "string"
            ? { type, payload, source: this, blockWave: false }
            : type;

        for (const child of this.children) {
            // Each branch gets its own wave so blocking one subtree
            // doesn't block its siblings.
            const wave: Wave = { ...base, blockWave: false };

            child.dispatchWave(wave);

            if (!wave.blockWave) {
                child.wave(wave);
            }
        }
    }

    dispatchWave(wave: Wave) {
        this.waveObservers.slice().forEach(fn => fn(wave));
    }

    observeWave(observer: WaveObserver) {
        this.waveObservers.push(observer);

        return () => {
            this.waveObservers = this.waveObservers.filter(pred => pred != observer);
        };
    }

    clone(): Store {
        const clone = new BaseStore(this.name, undefined, undefined, { ...this.config });
        for (const key of this.provider.keys()) {
            clone.provider.set(key, cloneValue(this.provider.get(key)));
        }

        clone.parent = this.parent;
        clone.parents = this._parents;
        return clone;
    }

    diverge(config?: ExtendedStoreConfig): Store {
        const { name, provider, parent, parents, initialState, initialValues, ...rest } = config || {};

        const clone = new BaseStore(name ?? this.name, provider, this, { ...rest, syncUp: false }, parents);
        seed(clone, initialValues);
        return clone;
    }

    subscribe(key: string, callback: MutationObserver): Unsubscriber {
        const subscribers = this.subscribers[key] || [];
        subscribers.push(callback);
        this.subscribers[key] = subscribers;

        return () => {
            const remaining = (this.subscribers[key] || []).filter(pred => pred != callback);
            if (remaining.length) this.subscribers[key] = remaining;
            else delete this.subscribers[key];
        };
    }

    subscribeHandler(key: string, handler: EventHandlerCallback): () => void {
        const handlers = this.handlers[key] || [];
        handlers.push(handler);
        this.handlers[key] = handlers;
        this.updateEventListeners();

        return () => {
            const remaining = (this.handlers[key] || []).filter(pred => pred != handler);
            if (remaining.length) this.handlers[key] = remaining;
            else delete this.handlers[key];
            this.updateEventListeners();
        };
    }

    notifyHandlers(key: string, type: EventTypes, ...args: any[]): void {
        this.handlers[key]?.slice().forEach(h => h(type, ...args));
    }

    /**
     * Window listeners are only attached while someone is listening, so
     * short-lived stores don't leak listeners.
     */
    private updateEventListeners() {
        const hasHandlers = Object.keys(this.handlers).length > 0;

        if (hasHandlers && !this.eventTeardown) {
            const notifyAll = (type: EventTypes) => {
                for (const key in this.handlers) this.notifyHandlers(key, type);
            };
            const stopFocus = listenForFocus(() => {
                if (isVisible()) notifyAll(EventTypes.Focus);
            });
            const stopReconnect = listenForReconnect(() => notifyAll(EventTypes.Reconnect));

            this.eventTeardown = () => {
                stopFocus();
                stopReconnect();
            };
        } else if (!hasHandlers && this.eventTeardown) {
            this.eventTeardown();
            this.eventTeardown = undefined;
        }
    }

    /** Registers this store with its parent and lookup parents (idempotent) */
    attach(): void {
        if (isHierarchicalStore(this._parent) && !this._parent.children.includes(this)) {
            this._parent.children.push(this);
        }
        this.connectLookups();
    }

    /** Unregisters this store from its parent and lookup parents */
    detach(): void {
        if (isHierarchicalStore(this._parent)) {
            this._parent.children = this._parent.children.filter(pred => pred !== this);
        }
        this.disconnectLookups();
    }

    /**
     * Detaches the store from its parents and removes every listener it owns.
     * The store can be re-attached afterwards by calling {@link attach}.
     */
    dispose(): void {
        this.detach();
        this.eventTeardown?.();
        this.eventTeardown = undefined;
        this.handlers = {};
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
        const { name, parent, parents, provider: _, initialState: __, initialValues: ___, ...rest } = config || {};

        const data = JSON.parse(serialized);

        const provider = new Map<string, any>();
        for (const key in data.provider) {
            provider.set(key, data.provider[key]);
        }

        const store = new BaseStore(name || data.name, provider, parent, { ...data.config, ...rest } as StoreConfig, parents);
        store.UUID = data.UUID;

        return store;
    }
}
