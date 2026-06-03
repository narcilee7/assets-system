// /**
//  * 函数柯里化
//  * 将多个参数的函数转换为一系列使用一个参数的函数的技术
//  * 
//  * 实现思路:
//  * - 判断传入参数是否达到原函数参数个数
//  * - 如果不够，继续返回一个新函数，收集参数
//  * - 如果够了，执行原函数
//  */

function curried(fn) {
  return function(...args) {
    // args承接了所有传入的参数
    // 如果参数个数达到原函数参数个数，则执行原函数
    // 否则返回一个新函数，继续收集参数
    if (args.length >= fn.length) {
      return fn.apply(this, args)
    } else {
      return function(...rest) {
        return curried.apply(this, args.concat(rest))
      }
    }
  }
}

const add = (a, b, c) => a + b + c

const curriedAdd = curried(add)

console.log(curriedAdd(1)(2)(3))
console.log(curriedAdd(1, 2)(3))
console.log(curriedAdd(1, 2, 3))