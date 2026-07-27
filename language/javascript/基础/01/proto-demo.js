function Person(name) {
  this.name = name;
}

Person.prototype.sayHi = function () {
  console.log('Hi, ' + this.name)
}

const p = new Person('Tom')

p.sayHi()

console.log(p.__proto__ === Person.prototype)
console.log(Person.prototype.__proto__ === Object.prototype)
console.log(Object.prototype.__proto__ === null)

// instance of的原理

function myInstanceOf(obj, Constructor) {
  let proto = Object.getPrototypeOf(obj)
  while (proto) {
    if (proto === Constructor.prototype) {
      return true
    }
    proto = Object.getPrototypeOf(proto)
    return false
  }
}

console.log(myInstanceOf([], Array))
console.log(myInstanceOf([], Object))
console.log(myInstanceOf(1, Number))

function myNew(Constructor, ...args) {
  // 创建一个空对象，原型指向Constructor.prototype
  const obj = Object.create(Constructor.prototype)
  // 执行构造函数，this绑定到新对象
  const result = Constructor.apply(obj, args)
  // 若构造函数返回对象/函数，则返回该值，否则返回新对象
  return (result !== null && (typeof result === 'object' || typeof result === 'function')) ? result : obj
}