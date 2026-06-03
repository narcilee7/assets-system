/**
 * 寄生组合式继承 Best
 */

function Parent(name) {
  this.name = name;
  this.colors = ["red", "blue", "green"];
}

Parent.prototype.sayHi = function () {
  console.log("Hi!");
}

function Child(name, age) {
  Parent.call(this, name);
  this.age = age;
}

Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;

const child1 = new Child("Tom", 10);
child1.colors.push("black");
console.log(child1);


/**
 * 寄生组合式继承是完美继承，构造函数只执行一次
 * 不共享引用数据类型
 */
