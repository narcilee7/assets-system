import {B} from "../../../../engineering/frontend/frameworks/nuxt/nuxt-app/.output/server/chunks/nitro/nitro.mjs";

const obj1 = Object.create(null)
const obj2 = {}


console.log(obj1.toString) // undefined
console.log(obj2.toString) // [Function: toString]

console.log(obj1 instanceof Object) // false
console.log(obj2 instanceof Object) // true

const dict = Object.create(null)

console.log(dict.toString)

class Button {
    handleClick1 = () => {
        console.log(this)
    }

    handleClick2() {
        console.log(this)
    }
}

const btn = new Button()

const fn1 = btn.handleClick1
const fn2 = btn.handleClick2

fn1() // Button instance
fn2() // undefined

const obj = {
    handleClick1: fn1,
    handleClick2: fn2,
}

console.log(obj.handleClick1())
console.log(obj.handleClick2())



