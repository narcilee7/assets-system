/**
 * 原型链继承
 */

function Parent() {
  this.name = "parent";
}

Parent.prototype.sayHi = function () {
  console.log("Hi!");
}

function Child() { }

Child.prototype = new Parent();
Child.prototype.constructor = Child;

const children = new Child();
children.sayHi();
console.log(children.name);

/**
 * 总结
 * 缺点：
 * 1. 所有实例共享引用类型属性
 * 2. 不能向父构造函数传参
 */

