"use client";

import { isDocumentDefined, isNull, isUndefined, isWindowDefined } from "./helpers";

const [connectWindowEvent, disconnectWindowEvent] =
    isWindowDefined && window.addEventListener
        ? [window.addEventListener.bind(window), window.removeEventListener.bind(window)]
        : [() => { }, () => { }];

let connected = true;
export const isConnected = () => connected;

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
    const handleConnection = () => {
        const old = connected;
        connected = true;
        if (!old) callback();
    }
    const handleDisconnection = () => {
        connected = false;
    }
    connectWindowEvent("online", handleConnection);
    connectWindowEvent("offline", handleDisconnection);

    return () => {
        disconnectWindowEvent("online", handleConnection);
        disconnectWindowEvent("offline", handleDisconnection);
    }
}

export const listenForWindowSync = (callback: (key: string, value: any, prev: any | undefined) => void) => {
    const parseValue = (v: string | null) => {
        try { return isNull(v) ? undefined : JSON.parse(v); }
        catch(e) { return undefined; }
    }

    const handleStorage = (event: StorageEvent) => {
        if(!event.key || !event.newValue) return;

        const value = parseValue(event.newValue);
        const prev = parseValue(event.oldValue);

        callback(event.key, value, prev);
    }

    connectWindowEvent("storage", handleStorage);

    return () => {
        disconnectWindowEvent("storage", handleStorage);
    }
}