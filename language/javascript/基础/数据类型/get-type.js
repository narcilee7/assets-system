function getType(value) {
    if (value === null) {
        return "null";
    }

    const type = typeof value

    if (type !== 'object' && typeof value !== 'function') {
        return type
    }

    const tag = Object.prototype.toString.call(value)
    return tag.slice(8, -1).toLowerCase()
}

console.log(getType([]))
console.log(getType(getType({})))
console.log(getType(null))
console.log(getType(undefined))