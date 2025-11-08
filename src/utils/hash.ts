"use client";

import { isUndefined } from "./helpers";

const contexts: Record<string, {
    counter: number,
    table: WeakMap<object, string>
}> = {};

const getType = (v: any) => Object.prototype.toString.call(v);
const isType = (type: string, target: string) => type === `[object ${target}]`

export function stableStringify(contextUUID: string, data: any): string {
    if(!(contextUUID in contexts)) {
        contexts[contextUUID] = { counter: 1, table: new WeakMap() };
    }

    let { counter, table } = contexts[contextUUID]!;

    const type = typeof data;
    const typeName = getType(data);
    const isDate = isType(typeName, "Date");
    const isRegex = isType(typeName, "RegExp");
    const isObject = isType(typeName, "Object");

    if (Object(data) === data && !isDate && !isRegex) {
        let result = table.get(data);
        if (result) return result;

        result = counter++ + "R";
        table.set(data, result);

        if (Array.isArray(data)) {
            result = "Arr"
            for (let i = 0; i < data.length; i++)
                result += stableStringify(contextUUID, data[i]) + ","
            table.set(data, result);
            return result;
        }
        if (isObject) {
            result = "Obj"
            const keys = Object.keys(data).sort();
            let key;
            while (!isUndefined((key = keys.pop() as string))) {
                if (!isUndefined(data[key])) {
                    result += `${key}:${stableStringify(contextUUID, data[key])},`
                }
            }
            table.set(data, result);
            return result;
        }
    }

    if (isDate)
        return (data as Date).toJSON()
    else if (type === "symbol")
        return (data as Symbol).toString()
    else if (type === "string")
        return JSON.stringify(data)
    else
        return "" + data
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8; // 'y' must be one of 8,9,a,b
    return v.toString(16);
  });
}