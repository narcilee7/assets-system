/**
 * 函数柯里化
 * 讲多个参数的函数转换为一系列使用一个参数的函数的技术
 * 
 * 实现思路:
 * - 判断传入参数是否达到原函数参数个数
 * - 如果不够，继续返回一个新函数，收集参数
 * - 如果够了，执行原函数
 */

function curry(fn) {
  return function curried(...args) {
    // console.log(args);
    if (args.length >= fn.length) {
      return fn.apply(this, args)
    } else {
      return function (...rest) {
        return curried.apply(this, args.concat(rest));
      }
    }
  }
}

function add(a, b, c) {
  return a + b + c;
}

const curriedAdd = curry(add);

console.log(curriedAdd(1)(2)(3));
console.log(curriedAdd(1, 2)(3));
console.log(curriedAdd(1, 2, 3));