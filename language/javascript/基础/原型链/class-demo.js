class Person {
    constructor(name) {
        this.name = name
    }

    sayHi() {
        return 'hi' + this.name
    }

    static species = "Home spaiens"
}

// 等价
function Person1(name) {
    this.name = name
}

Person1.prototype.sayHi = function () {
    return 'hi' + this.name
}

Object.defineProperty(Person1.prototype, 'species', {
    value: 'Homo sapiens',
    writable: true,
    enumerable: true,
    configurable: true
});

console.log(Person === Person1)