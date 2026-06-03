// class Parent {
//   constructor(name) {
//     this.name = name;
//   }

//   sayHi() {
//     console.log('Hi!');
//   }
// }

// class Child extends Parent {
//   constructor(name) {
//     super(name);
//     this.age = age;
//   }
// }

// const child = new Child('John', 10);

// child.sayHi();

/**
 * ES6 class本质上仍然是寄生组合式继承
 */


// 手写Class

/**
 * class继承的本质：
 * 1. super(): 在子类构造函数中调用父类构造函数
 * 2. 原型链继承: 子类的原型指向父类原型
 */

function createClass(definition) {
  // 取出父类
  const Parent = definition.extends || null;
  // 构造函数
  const Constructor = function (...args) {
    if (typeof definition.constructor === 'function') {
      definition.constructor.apply(this, args);
    }
  }
  // 处理原型链
  if (Parent) {
    Constructor.prototype = Object.create(Parent.prototype);
  }
  Constructor.prototype.constructor = Constructor;

  // 绑定方法到原型
  for (let key in definition) {
    if (key !== 'constructor' && key !== 'extends') {
      Constructor.prototype[key] = definition[key];
    }
  }

  return Constructor;
}

const Parent1 = createClass({
  constructor(name) {
    this.name = name;
  },
  sayHi() {
    console.log('Hi!');
  }
})

const Child1 = createClass({
  extends: Parent1,
  constructor(name, age) {
    console.log(name, age);
    Parent1.call(this, name);
    this.age = age;
  },
  sayAge() {
    console.log(`I'm ${this.age} years old.`);
  }
})

const c = new Child1('John', 10);
c.sayHi();
c.sayAge();

function cC(definition) {
  const Parent = definition.extends || null;
  const Constructor = function (...args) {
    if (typeof definition.constructor === 'function') {
      definition.constructor.apply(this, args);
    }
  }
  if (Parent) {
    Constructor.prototype = Object.create(Parent.prototype);
  }
  Constructor.prototype.constructor = Constructor;
  for (let key in definition) {
    if (key !== 'constructor' && key !== 'extends') {
      Constructor.prototype[key] = definition[key];
    }
  }
  return Constructor;
}