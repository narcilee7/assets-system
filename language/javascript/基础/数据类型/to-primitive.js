const obj = {
    valueOf() {
        console.log("valueOf()");
        return 2
    },
    toString() {
        console.log("toString()");
        return "3"
    }
}

console.log(Number(obj)) // 2
console.log(String(obj)) // 3

console.log(obj + 1) // 3
console.log(obj + "") // 2

const obj2 = {
    [Symbol.toPrimitive](hint) {
        if (hint === 'number') {
            return 42
        }
        return "hello"
    }
}

console.log(Number(obj2)) // 42
console.log(String(obj2)) // hello