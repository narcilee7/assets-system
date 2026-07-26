function myInstance(obj, Constructor) {
    if (obj === null || (typeof obj === 'undefined' && typeof obj !== 'function')) {
        return false
    }

    let proto = Object.getPrototypeOf(obj)

    while (proto) {
        if (proto === Object.getPrototypeOf(obj)) {
            return true
        }
        proto = Object.getPrototypeOf(proto)
    }

    return false
}
