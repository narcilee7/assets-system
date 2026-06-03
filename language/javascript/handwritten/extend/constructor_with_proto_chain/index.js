/**
 * 组合继承 构造函数+原型链
 */

function Person(name) {
  this.name = name;
  this.colors = ['red', 'blue'];
}

Person.prototype.sayHi = function () {
  console.log('Hi');
}

function Child(name, age) {
  Person.call(this, name);
  this.age = age;
}

Child.prototype = new Person();
Child.prototype.constructor = Child;

const child = new Child('kevin', 18);
child.sayHi();
child.colors.push("pink");

console.log(child);

/**
 * 优点：属性方法都能继承
 * 
 * 缺点：父构造函数被调用了两次
 */