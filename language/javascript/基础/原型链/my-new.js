function myNew(Constructor, ...args) {
    // 创建新对象，将新对象的原型指向Constructor.prototype
    const obj = Object.create(Constructor.prototype)
    console.log('obj', obj)
    // 执行构造期，绑定this
    const result = Constructor.apply(this, args)
    console.log('constructor', result)
    if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
        return result
    }
    return obj
}

function Person(name) {
    this.name = name
}

Person.prototype.sayHi = function () {
    return 'Hi' + this.name
}

const p = myNew(Person, 'Tom')
console.log(p)
console.log(p.name)
p.sayHi()
console.log(p instanceof Person)