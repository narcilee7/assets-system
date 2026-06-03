/**
 * 借用构造函数继承
 */

function Parent(name) {
  this.name = name;
}


function Child(name) {
  // 调用构造函数
  Parent.call(this, name);
}

const child = new Child('child');

console.log(child);

/**
 * 缺点是：方法不能复用，父类的原型方法无法继承
 */