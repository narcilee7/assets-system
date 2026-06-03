Function.prototype.myCall = function (ctx, ...args) {
  ctx = ctx || globalThis; // 兼容null/undefined
  const fnKey = Symbol("fn"); // 避免覆盖原有属性
  ctx[fnKey] = this; // 把函数赋值给ctx
  const result = ctx[fnKey](...args);
  delete ctx[fnKey];
  return result;
}

Function.prototype.myApply = function (ctx, args) {
  ctx = ctx || globalThis;
  const fnKey = Symbol("fn");
  ctx[fnKey] = this;
  let result;
  if (args) {
    result = ctx[fnKey](...args);
  } else {
    result = ctx[fnKey]();
  }
  delete ctx[fnKey];
  return result;
}

Function.prototype.myBind = function (ctx, ...args) {
  const self = this;
  function boundFunction(...innerArgs) {
    const finalArgs = [...args, ...innerArgs];
    // 处理new绑定
    if (this instanceof boundFunction) {
      return new self(...finalArgs);
    }
    return self.apply(ctx, finalArgs);
  } 
  boundFunction.prototype = Object.create(self.prototype);
  return boundFunction;
}

// 测试
function Person(name, age) {
  this.name = name;
  this.age = age;
}
const obj = {};
const BoundPerson = Person.myBind(obj, '张三');

const p1 = new BoundPerson(20);
console.log(p1); // Person { name: '张三', age: 20 }