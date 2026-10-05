import { isUndefined } from "./helpers";

// Identity keys must hash the same in every store, otherwise a store
// couldn't find them in its parents. Hence one table for all contexts.
const identities = {
    counter: 1,
    table: new WeakMap<object, string>(),
};

const getType = (v: any) => Object.prototype.toString.call(v);
const isType = (type: string, target: string) => type === `[object ${target}]`

/**
 * Serializes a key into a string. Top level strings are kept as-is, arrays and
 * plain objects are serialized by content, other objects by identity.
 *
 * `contextUUID` is kept for API compatibility and no longer affects the result.
 */
export function stableStringify(contextUUID: string, data: any, depth = 0): string {
    const { table } = identities;

    const type = typeof data;
    const typeName = getType(data);
    const isDate = isType(typeName, "Date");
    const isRegex = isType(typeName, "RegExp");
    const isObject = isType(typeName, "Object");

    if (Object(data) === data && !isDate && !isRegex) {
        let result = table.get(data);
        if (result) return result;

        result = identities.counter++ + "R";
        table.set(data, result);

        if (Array.isArray(data)) {
            result = "Arr"
            for (let i = 0; i < data.length; i++)
                result += stableStringify(contextUUID, data[i], depth + 1) + ","
            table.set(data, result);
            return result;
        }
        if (isObject) {
            result = "Obj"
            const keys = Object.keys(data).sort();
            let key;
            while (!isUndefined((key = keys.pop() as string))) {
                if (!isUndefined(data[key])) {
                    result += `${key}:${stableStringify(contextUUID, data[key], depth + 1)},`
                }
            }
            table.set(data, result);
            return result;
        }

        // Non-plain objects (Map, class instances...) are keyed by identity
        return result;
    }

    if (isDate)
        return (data as Date).toJSON()
    else if (type === "symbol")
        return (data as symbol).toString()
    else if (type === "string" && depth > 0)
        return JSON.stringify(data)
    else
        return "" + data
}

export function generateUUID() {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  const random = () => c && typeof c.getRandomValues === "function"
    ? c.getRandomValues(new Uint8Array(1))[0]
    : Math.floor(Math.random() * 256);

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = random() & 0xf;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8; // 'y' must be one of 8,9,a,b
    return v.toString(16);
  });
}