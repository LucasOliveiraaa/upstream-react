import { isDocumentDefined, isNull, isUndefined, isWindowDefined } from "./helpers";

const [connectWindowEvent, disconnectWindowEvent] =
    isWindowDefined && window.addEventListener
        ? [window.addEventListener.bind(window), window.removeEventListener.bind(window)]
        : [() => { }, () => { }];

export const isConnected = () =>
    typeof navigator === "undefined" || isUndefined(navigator.onLine) || navigator.onLine;

export const isVisible = () => {
    const visibility = isDocumentDefined && document.visibilityState;
    return !isUndefined(visibility) && visibility !== "hidden";
}

export const listenForFocus = (callback: () => void) => {
    if (isDocumentDefined) {
        document.addEventListener("visibilitychange", callback);
    }
    connectWindowEvent("focus", callback);

    return () => {
        if (isDocumentDefined) {
            document.removeEventListener("visibilitychange", callback);
        }
        disconnectWindowEvent("focus", callback);
    }
}

export const listenForReconnect = (callback: () => void) => {
    connectWindowEvent("online", callback);

    return () => {
        disconnectWindowEvent("online", callback);
    }
}

export const listenForWindowSync = (
    storage: Storage,
    callback: (key: string, value: any, prev: any | undefined) => void
) => {
    const parseValue = (v: string | null) => {
        if (isNull(v)) return undefined;
        try { return JSON.parse(v); }
        catch (e) { return v; }
    }

    const handleStorage = (event: StorageEvent) => {
        // `key` is null when the whole storage was cleared
        if (!event.key || event.storageArea !== storage) return;

        callback(event.key, parseValue(event.newValue), parseValue(event.oldValue));
    }

    connectWindowEvent("storage", handleStorage);

    return () => {
        disconnectWindowEvent("storage", handleStorage);
    }
}
