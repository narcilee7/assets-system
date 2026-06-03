/**
 * 原型式继承
 */

const parent = {
  name: "parent",
  sayHi() {
    console.log("Hi!");
  }
}

const child = Object.create(parent);
child.name = "child";
child.sayHi();

/**
 * 对象属性为引用类型时会共享
 * 无法传参
 */

