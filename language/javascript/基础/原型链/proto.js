function Person(name) {
    this.name = name;
}

const p = new Person("tom");

// Person.h
console.log(Person.hasOwnProperty("prototype"));
console.log(Person.prototype);

console.log(Person.hasOwnProperty("__proto__"))
console.log(p.__proto__ === Person.prototype)

console.log(Object.getPrototypeOf(p) === Person.prototype)
console.log(Object.getPrototypeOf(Person) === Function.prototype)
console.log(Object.getPrototypeOf(Function.prototype) === Object.prototype)
console.log(Object.getPrototypeOf(Object.prototype) === null)

