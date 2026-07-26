class Animal {
    constructor(name) {
        this.name = name
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name);
        this.breed = breed;
    }
}

console.log(Object.getPrototypeOf(Dog) === Animal)
console.log(Object.getOwnPropertyDescriptor(Dog));