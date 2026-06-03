/**
 * typeof是js的原生操作符，能返回一个值的类型字符串
 * @param {*} value 
 * @returns 
 */

function myTypeof(value) {
  if (value === null) return "object"; 
  return typeof value === 'function' ? 'function' : typeof value;
}

function test(params) {
  console.log(params);
}

const arr = [1, 2, 3];

console.log(myTypeof(test));
console.log(myTypeof(arr));
