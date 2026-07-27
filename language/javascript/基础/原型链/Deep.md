# 深入原型链与继承

# JavaScript 原型与继承 — 深度篇

---

## 一、原型系统的本质：规范视角

ECMAScript 规范中，原型不是"机制"，而是**对象的内部槽**：

```
每个对象都有一个内部槽 [[Prototype]]（以前叫 [[Proto]]）
- 它要么为 null，要么指向另一个对象
- 这就是该对象的"原型"
```

**注意**：`[[Prototype]]` 是内部槽，JS 代码无法直接访问。浏览器暴露的 `__proto__` 是遗留的 getter/setter，标准方法是 `Object.getPrototypeOf()` / `Object.setPrototypeOf()`。

---

## 二、`__proto__` vs `prototype` — 彻底区分

从**所属者**和**用途**两个维度拆解：

| | `prototype` | `__proto__` / `[[Prototype]]` |
|--|-------------|------------------------------|
| **存在于** | **函数对象**（作为构造器时） | **所有对象**（除了 `Object.create(null)`）|
| **性质** | 普通属性（可枚举性取决于定义方式） | 内部槽的访问器（非属性，是遗留的 accessor）|
| **用途** | 定义"由该构造器创建的实例"的原型 | 对象自身的原型链指针 |
| **方向** | 构造器 → 实例的原型 | 实例 → 它的原型 |
| **标准性** | 标准属性 | `__proto__` 是 Annex B（浏览器遗留），标准用 `Object.getPrototypeOf` |

**关系图**：

```
构造函数 Person                    实例 p
  │                                │
  ├─ prototype ───────────────┐   │
  │    { constructor: Person } │   │
  │         ↑                  │   │
  │    __proto__               │   │
  │  （p.[[Prototype]]）        │   │
  │                            ↓   │
  └───────────────────────────────┘

Person.prototype.constructor === Person  // true
p.__proto__ === Person.prototype        // true
Object.getPrototypeOf(p) === Person.prototype  // true
```

**代码验证**：

```javascript
function Person(name) {
  this.name = name;
}

const p = new Person('Tom');

// prototype 是函数的属性
Person.hasOwnProperty('prototype');  // true
Person.prototype;  // { constructor: Person }

// __proto__ 是实例的原型链指针
p.hasOwnProperty('__proto__');  // false（不是自有属性，是继承的 getter）
p.__proto__ === Person.prototype;  // true

// 标准方法
Object.getPrototypeOf(p) === Person.prototype;  // true
Object.getPrototypeOf(Person) === Function.prototype;  // true
Object.getPrototypeOf(Function.prototype) === Object.prototype;  // true
Object.getPrototypeOf(Object.prototype) === null;  // true（原型链终点）
```

---

## 三、原型链的查找机制

### 1. 属性查找算法（规范级）

当访问 `obj.prop` 时，引擎执行以下步骤：

1. 检查 `obj` 自身是否有该属性（`obj.[[OwnProperty]](prop)`）
2. 若无，沿 `obj.[[Prototype]]` 向上查找
3. 重复步骤 1-2，直到找到属性或 `[[Prototype]] === null`
4. 若始终未找到：
    - **读取**：返回 `undefined`
    - **赋值**：在 `obj` 自身创建该属性（除非原型上有只读 setter）

```javascript
const grandparent = { a: 1 };
const parent = Object.create(grandparent);
parent.b = 2;
const child = Object.create(parent);

child.a;  // 1（child → parent → grandparent → Object.prototype → null）
child.b;  // 2（child → parent 找到）
child.c;  // undefined（整条链都没有）
child.toString;  // [Function: toString]（Object.prototype 上）

// 原型链可视化：
// child
//   [[Prototype]] → parent
//                    [[Prototype]] → grandparent
//                                     [[Prototype]] → Object.prototype
//                                                      [[Prototype]] → null
```

### 2. `hasOwnProperty` vs `in` 运算符

```javascript
const obj = { own: 1 };
Object.setPrototypeOf(obj, { inherited: 2 });

obj.hasOwnProperty('own');        // true（只检查自身）
obj.hasOwnProperty('inherited');  // false

'own' in obj;        // true
'inherited' in obj;  // true（in 检查整条原型链）

// 现代替代：Object.hasOwn()（不依赖原型链上的方法）
Object.hasOwn(obj, 'own');  // true
```

---

## 四、`new` 操作符的完整实现

### 1. 规范步骤（ECMAScript）

执行 `new Constructor(...args)` 时：

1. 创建新对象 `obj`
2. 将 `obj.[[Prototype]]` 设为 `Constructor.prototype`
3. 执行 `Constructor`，`this` 绑定到 `obj`
4. 若构造器返回对象/函数，则返回该值；否则返回 `obj`

### 2. 手写实现（面试版）

```javascript
function myNew(Constructor, ...args) {
  // 1. 创建新对象，原型指向 Constructor.prototype
  const obj = Object.create(Constructor.prototype);
  
  // 2. 执行构造器，绑定 this
  const result = Constructor.apply(obj, args);
  
  // 3. 判断返回值类型
  // 若返回对象或函数，则返回该值；否则返回 obj
  return (result !== null && (typeof result === 'object' || typeof result === 'function'))
    ? result
    : obj;
}

// 验证
function Person(name) {
  this.name = name;
}
Person.prototype.sayHi = function() {
  return 'Hi, ' + this.name;
};

const p = myNew(Person, 'Tom');
p.name;     // 'Tom'
p.sayHi();  // 'Hi, Tom'
p instanceof Person;  // true
```

### 3. 边界情况

```javascript
// 构造器返回对象（覆盖默认实例）
function ReturnObject() {
  this.a = 1;
  return { b: 2 };
}
const obj1 = new ReturnObject();
obj1.a;  // undefined（被返回对象覆盖）
obj1.b;  // 2

// 构造器返回原始值（忽略，仍返回实例）
function ReturnPrimitive() {
  this.a = 1;
  return 999;
}
const obj2 = new ReturnPrimitive();
obj2.a;  // 1
```

---

## 五、ES6 Class 的语法糖本质

### 1. Class 不是新的继承机制

ES6 的 `class` 只是**原型继承的语法糖**，底层完全基于 `prototype`：

```javascript
class Person {
  constructor(name) {
    this.name = name;
  }
  
  sayHi() {
    return 'Hi, ' + this.name;
  }
  
  static species = 'Homo sapiens';
}

// 等价于（概念上）：
function Person(name) {
  this.name = name;
}
Person.prototype.sayHi = function() {
  return 'Hi, ' + this.name;
};
Object.defineProperty(Person, 'species', {
  value: 'Homo sapiens',
  writable: true,
  enumerable: true,
  configurable: true
});
```

**关键差异**：

| | ES5 构造函数 | ES6 Class |
|--|------------|-----------|
| 提升 | 函数声明提升 | 不提升（类似 `let`）|
| 调用方式 | 可直接调用 `Person()` | 必须用 `new`，否则抛 TypeError |
| 严格模式 | 默认非严格 | 默认严格模式 |
| 枚举性 | `prototype` 方法默认可枚举 | `prototype` 方法默认不可枚举 |
| 继承内置类 | 困难（如继承 Error、Array）| 原生支持 `extends` |

### 2. `extends` 的底层操作

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);  // 调用父类构造器
    this.breed = breed;
  }
}

// 引擎内部（简化）：
// 1. Dog.[[Prototype]] = Animal（静态继承）
// 2. Dog.prototype = Object.create(Animal.prototype, {
//      constructor: { value: Dog, writable: true, configurable: true }
//    })
// 3. Dog.prototype.[[Prototype]] = Animal.prototype
```

**`super` 的两种用法**：

```javascript
class Child extends Parent {
  constructor() {
    super();           // 作为函数调用：调用父类构造器，只能在 constructor 中
  }
  
  method() {
    super.method();    // 作为对象引用：Parent.prototype.method.call(this)
  }
}
```

---

## 六、继承方案演进

### 1. 原型链继承（问题最大）

```javascript
function Parent() {
  this.colors = ['red', 'blue'];
}

function Child() {}
Child.prototype = new Parent();  // 问题：Parent 被提前执行

const c1 = new Child();
c1.colors.push('green');
const c2 = new Child();
c2.colors;  // ['red', 'blue', 'green']！共享引用类型
```

**问题**：
- 父类构造器在定义时执行，无法传参
- 所有实例共享父类引用类型属性
- 无法向父类构造器传参

### 2. 借用构造函数继承（伪造对象）

```javascript
function Parent(name) {
  this.name = name;
  this.colors = ['red', 'blue'];
}

function Child(name, age) {
  Parent.call(this, name);  // 借用父类构造器
  this.age = age;
}

const c1 = new Child('Tom', 20);
c1.colors.push('green');
const c2 = new Child('Jerry', 18);
c2.colors;  // ['red', 'blue']（不共享）

// 问题：
// Child.prototype 与 Parent.prototype 无关
// c1 instanceof Parent === false！
// 方法必须在构造器中定义，无法复用
```

### 3. 组合继承（原型链 + 借用构造器）

```javascript
function Parent(name) {
  this.name = name;
  this.colors = ['red', 'blue'];
}
Parent.prototype.sayName = function() {
  return this.name;
};

function Child(name, age) {
  Parent.call(this, name);  // 第二次调用 Parent
  this.age = age;
}
Child.prototype = new Parent();  // 第一次调用 Parent
Child.prototype.constructor = Child;

// 问题：Parent 被调用了两次！
// 1. Child.prototype = new Parent() 时
// 2. new Child() 内部 Parent.call(this) 时
// Child.prototype 上有冗余的 name 和 colors（被实例属性覆盖）
```

### 4. 寄生组合继承（最优 ES5 方案）

```javascript
function inheritPrototype(Child, Parent) {
  // 创建父类原型的副本，作为子类原型
  const prototype = Object.create(Parent.prototype);
  prototype.constructor = Child;
  Child.prototype = prototype;
}

function Parent(name) {
  this.name = name;
  this.colors = ['red', 'blue'];
}
Parent.prototype.sayName = function() {
  return this.name;
};

function Child(name, age) {
  Parent.call(this, name);  // 只调用一次
  this.age = age;
}
inheritPrototype(Child, Parent);

Child.prototype.sayAge = function() {
  return this.age;
};

// 验证
const c = new Child('Tom', 20);
c.sayName();  // 'Tom'
c.sayAge();   // 20
c instanceof Child;   // true
c instanceof Parent;  // true
Object.getPrototypeOf(c) === Child.prototype;  // true
Object.getPrototypeOf(Child.prototype) === Parent.prototype;  // true
```

**寄生组合继承的优势**：
- 只调用一次父类构造器
- 原型链完整（`instanceof` 正常）
- 避免在 `Child.prototype` 上创建不必要的实例属性
- 是 ES5 中**最理想的继承模式**

---

## 七、ES6 Class 继承的深层机制

### 1. `extends null` 与内置类继承

```javascript
// 继承内置类（ES5 极难实现，ES6 原生支持）
class MyArray extends Array {
  first() {
    return this[0];
  }
}

const arr = new MyArray(1, 2, 3);
arr.first();       // 1
arr instanceof Array;  // true
arr instanceof MyArray; // true

// 底层：引擎使用 Symbol.species 等机制确保内置方法返回正确的子类实例
```

### 2. `new.target` — 构造器中的元信息

```javascript
class Parent {
  constructor() {
    console.log(new.target);  // 指向实际被 new 的构造器
    if (new.target === Parent) {
      throw new Error('Parent 不能直接实例化');
    }
  }
}

class Child extends Parent {
  constructor() {
    super();  // new.target 仍为 Child
  }
}

new Child();   // 正常
new Parent();  // Error: Parent 不能直接实例化
```

### 3. Class 的私有字段（#private）

```javascript
class Counter {
  #count = 0;  // 真正私有，不在原型上，不通过 this 暴露
  
  get #formatted() {  // 私有 getter
    return `Count: ${this.#count}`;
  }
  
  increment() {
    this.#count++;
    return this.#formatted;
  }
}

const c = new Counter();
c.increment();        // "Count: 1"
c.#count;             // SyntaxError: Private field must be declared in an enclosing class
c.hasOwnProperty('#count');  // false（私有字段不是属性）

// 底层：引擎为每个实例维护一个独立的私有槽（Private Name），
// 与属性系统完全隔离，无法从外部访问
```

---

## 八、Object.create 的替代继承

```javascript
// 纯原型委托（无构造器函数）
const personPrototype = {
  greet() {
    return 'Hello, ' + this.name;
  }
};

const tom = Object.create(personPrototype);
tom.name = 'Tom';
tom.greet();  // 'Hello, Tom'

// Object.create 的 polyfill（面试版）
if (!Object.create) {
  Object.create = function(proto, propertiesObject) {
    if (typeof proto !== 'object' && typeof proto !== 'function') {
      throw new TypeError('Object prototype may only be an Object or null');
    }
    
    function F() {}
    F.prototype = proto;
    const obj = new F();
    
    if (propertiesObject !== undefined) {
      Object.defineProperties(obj, propertiesObject);
    }
    
    return obj;
  };
}
```

---

## 九、面试高频题拆解

### 题 1：`instanceof` 的原理与手写

```javascript
// 原理：检查 Constructor.prototype 是否在 obj 的原型链上
function myInstanceof(obj, Constructor) {
  // 原始类型直接返回 false
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return false;
  }
  
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto === Constructor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

// 边界
myInstanceof([], Array);       // true
myInstanceof([], Object);      // true
myInstanceof(1, Number);       // false（原始类型）
myInstanceof(new Number(1), Number);  // true
```

### 题 2：以下代码输出什么？

```javascript
function Foo() {
  Foo.a = function() { console.log(1); };
  this.a = function() { console.log(2); };
}
Foo.prototype.a = function() { console.log(3); };
Foo.a = function() { console.log(4); };

Foo.a();           // ?
const obj = new Foo();
obj.a();           // ?
Foo.a();           // ?
```

**拆解**：

```javascript
// 1. Foo.a = function() { console.log(4); }
//    给函数对象 Foo 添加静态方法 a

// 2. Foo.a() → 4（直接访问函数对象的属性）

// 3. new Foo() 时：
//    - Foo.a = function() { console.log(1); }（覆盖静态方法）
//    - this.a = function() { console.log(2); }（实例属性）

// 4. obj.a() → 2（实例属性优先于原型）

// 5. Foo.a() → 1（静态方法已被构造器执行覆盖）

// 输出：4 → 2 → 1
```

### 题 3：`Object.create(null)` 与 `{}` 的区别

```javascript
const obj1 = Object.create(null);
const obj2 = {};

// obj1 没有原型链
Object.getPrototypeOf(obj1);  // null
Object.getPrototypeOf(obj2);  // Object.prototype

// obj1 没有继承任何方法
obj1.toString;  // undefined
obj2.toString;  // [Function: toString]

// obj1 不是 Object 的实例
obj1 instanceof Object;  // false
obj2 instanceof Object;  // true

// 使用场景：纯字典/Map 的轻量替代，避免原型链污染
const dict = Object.create(null);
dict['toString'] = 'value';  // 安全，不会与 Object.prototype.toString 冲突
```

### 题 4：Class 中箭头函数 vs 普通方法

```javascript
class Button {
  // 类字段箭头函数：每个实例独立一份
  handleClick1 = () => {
    console.log(this);  // 永远指向实例（词法绑定）
  };
  
  // 普通方法：在原型上，所有实例共享
  handleClick2() {
    console.log(this);  // 取决于调用方式
  }
}

const btn = new Button();
const fn1 = btn.handleClick1;
const fn2 = btn.handleClick2;

fn1();  // Button 实例（箭头函数，this 绑定实例）
fn2();  // undefined（严格模式）或全局对象（非严格）

// 内存差异：
// handleClick1：每个实例一份，N 个实例 = N 份函数
// handleClick2：原型上一份，所有实例共享
```

---

## 十、原型污染（Prototype Pollution）— 安全视角

```javascript
// 攻击向量：通过对象合并污染原型
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
const target = {};
Object.assign(target, payload);

// 污染结果：
const victim = {};
victim.isAdmin;  // true！（Object.prototype 被污染）

// 防御：
// 1. 使用 Object.create(null) 创建对象
// 2. 合并前检查 key 是否为 '__proto__'、'constructor'、'prototype'
// 3. 使用 Object.freeze(Object.prototype)
// 4. 使用 Map 替代对象作为字典
```

---

## 十一、总结速查

| 概念 | 要点 |
|-----|------|
| `[[Prototype]]` | 对象的内部槽，指向原型对象 |
| `__proto__` | 访问 `[[Prototype]]` 的遗留 getter/setter |
| `prototype` | 函数对象的属性，指向"实例的原型" |
| `new` | 创建对象 → 链接原型 → 绑定 this → 执行构造器 → 处理返回值 |
| 原型链查找 | 自身 → `[[Prototype]]` → ... → `null` |
| `instanceof` | 检查 `Constructor.prototype` 是否在原型链上 |
| 寄生组合继承 | 最优 ES5 方案：`Object.create(Parent.prototype)` + `Parent.call(this)` |
| ES6 Class | 原型继承的语法糖，默认严格模式，方法不可枚举 |
| 私有字段 `#` | 真正私有，与属性系统隔离，语法级保护 |

---
