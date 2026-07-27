function deepClone(value, hash = new WeakMap()) {
    // 处理 null 和非对象
    if (value === null || typeof value !== "object") return value;

    // 处理循环引用
    if (hash.has(value)) return hash.get(value);

    // 处理 Date
    if (value instanceof Date) return new Date(value);

    // 处理 RegExp
    if (value instanceof RegExp) return new RegExp(value);

    // 处理 Map
    if (value instanceof Map) {
        const copy = new Map();
        hash.set(value, copy);
        value.forEach((v, k) => {
            copy.set(deepClone(k, hash), deepClone(v, hash));
        });
        return copy;
    }

    // 处理 Set
    if (value instanceof Set) {
        const copy = new Set();
        hash.set(value, copy);
        value.forEach(v => copy.add(deepClone(v, hash)));
        return copy;
    }

    // 处理 Array
    if (Array.isArray(value)) {
        const copy = [];
        hash.set(value, copy);
        value.forEach((item, index) => {
            copy[index] = deepClone(item, hash);
        });
        return copy;
    }

    // 处理普通对象（包括拷贝原型链）
    const copy = Object.create(Object.getPrototypeOf(value));
    hash.set(value, copy);

    // 拷贝所有属性，包括 Symbol 属性和不可枚举属性
    Reflect.ownKeys(value).forEach(key => {
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (desc) {
            Object.defineProperty(copy, key, {
                ...desc,
                value: deepClone(desc.value, hash)
            });
        }
    });

    return copy;
}