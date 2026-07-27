const grandParent = {
    a: 1,
}

const parent = Object.create(grandParent)
parent.b = 2

const child = Object.create(parent)

console.log(child.a)
console.log(child.b)
console.log(child.c)
console.log(child.toString)

// console.log('')
const obj = { own: 1 };
Object.setPrototypeOf(obj, { inherited: 2 });

console.log(obj.hasOwnProperty('own'))      // true（只检查自身）
console.log(obj.hasOwnProperty('inherited'));  // false

console.log('own' in obj);        // true
console.log('inherited' in obj);  // true（in 检查整条原型链）

// 现代替代：Object.hasOwn()（不依赖原型链上的方法）
console.log(Object.hasOwn(obj, 'own'));  // true
