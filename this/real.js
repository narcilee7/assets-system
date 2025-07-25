/**
 * call: 会立即调用函数，并且能够显式制定this的指向，call的参数第一个要绑定给this的对象，后面是传递给函数的参数
 */

function greet(greeting) {
    console.log(`${greeting}, ${this.name}`)
}

const person = {
    name: "John"
}

greet.call(person, "Hello")

Function.prototype.myCall = function (context, ...args) {
    // 如果没有传入context，则默认绑定到global
    const thisArg = context || globalThis
    // 将函数绑定到thisArg上
    thisArg.fn = this
    // 执行函数
    const result = thisArg.fn(...args)
    // 删除绑定
    delete thisArg.fn
    return result
}

greet.myCall(person, "Hi")
greet.call(person, "Hello")

/**
 * apply: 与call类似，但apply的参数是数组，数组中的第一个元素是要绑定给this的对象，后面是传递给函数的参数
 */

greet.apply(person, ["Hello"])

Function.prototype.myApply = function (context, argsArray) {
    const thisArg = context || globalThis
    thisArg.fn = this
    const result = thisArg.fn(...argsArray)
    delete thisArg.fn
    return result
}

greet.myApply(person, ["Wj"])
greet.apply(person, ["Wj"])

/**
 * bind: 与call和apply类似，但bind不会立即调用函数，而是返回一个新函数，新函数的this会被绑定到bind的第一个参数
 */

Function.prototype.myBind = function (context, ...args) {
    const fn = this
    return function (...newArgs) {
        // 将this绑定为context，并且将args和newArgs合并后作为参数传递给fn
        return fn.apply(context, args.concat(newArgs))
    }   
}

const newGreet = greet.myBind(person)

newGreet("Hello")
newGreet("Hi")


