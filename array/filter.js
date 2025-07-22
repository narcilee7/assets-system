/**
 * filter
 * 过滤符合条件的元素，返回新数组。
 */

// Array.prototype.myFilter = function(callback, thisArg) {
//   if (typeof callback !== 'function') {
//     throw new TypeError(callback + 'is not a function');
//   }
//   const arr = this;
//   const result = [];
//   for (let i = 0; i < arr.length; i++) {
//     if (arr.hasOwnProperty(i) && callback.call(thisArg, arr[i], i, arr)) {
//       result.push(arr[i]);
//     }
//   }
//   return result;
// }

// const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// console.log(arr.myFilter(item => item % 2 === 0));

Array.prototype.MyFilter = function(callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + 'is not a function')
  }
  const arr = this
  const result = []
  for (let i = 0; i < arr.length; i++) {
    if (arr.hasOwnProperty(i) && callback.call(thisArg, arr[i], i, arr)) {
      result.push(arr[i])
    }
  }
  return result
}
const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
console.log(arr.MyFilter(item => item % 2 === 0));