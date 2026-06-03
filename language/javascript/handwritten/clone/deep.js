// function deepCopyJSON(obj) {
//   return JSON.parse(JSON.stringify(obj));
// }

// /**
//  * 缺点在于：
//  * 1. 无法拷贝函数
//  * 2. undefined
//  * 3. Symbol
//  * 4. 循环引用
//  */


// /**
//  * WeakMap记录哪些对象已经复制过，避免重复拷贝、解决循环引用问题
//  * WeakMap:
//  * - key只能是对象
//  * - 弱引用，不会阻止垃圾回收
//  * 
//  * @param {*} obj 目标对象
//  * @param {*} hash 旧weakMap
//  * @returns 
//  */
// function deepClone(obj, hash = new WeakMap()) {
//   if (obj === null || typeof obj !== 'object') return obj

//   if (hash.has(obj)) return hash.get(obj)

//   const result = Array.isArray(obj) ? [] : {}

//   hash.set(obj, result)

//   for (const key in obj) {
//     if (obj.hasOwnProperty(key)) {
//       result[key] = deepClone(obj[key], hash)
//     }
//   }

//   return result
// }

// const obj = { name: 'Tom' };
// obj.self = obj;

// const newObj = deepClone(obj);
// console.log(newObj); // { name: 'Tom', self: [Circular] }

// console.log(obj.toString() === newObj.toString())
// console.log(obj === newObj)

/**
 * 深拷贝
 * 
 * 这种方法的问题:
 * 1. 无法拷贝函数
 * 2. undefined
 * 3. Symbol
 * 4. 循环引用
 * 5. 不能拷贝对象的原型链
 * 6. 不能拷贝Date对象
 * 7. 不能拷贝RegExp对象  
 */
function deepCloneJSON(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 深拷贝
 */
function deepClone(obj, hash = new WeakMap()) {
  if (typeof obj !== 'object' || obj === null) return obj

  if (hash.has(obj)) return hash.get(obj)

  const result = Array.isArray(obj) ? [] : {}

  hash.set(obj, result)

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // 处理对象的属性
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        result[key] = deepClone(obj[key], hash)
      } else {
        // 处理基本类型的属性
        result[key] = obj[key]
      }
    }
  }

  return result
}
