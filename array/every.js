// Array.prototype.myEvery = function (callback, thisArg) {
//   const arr = this;
//   if (typeof callback !== 'function') {
//     throw new TypeError(callback + 'is not a function');
//   }
//   for (let i = 0; i < arr.length; i++) {
//     if (arr.hasOwnProperty(i) && !callback.call(thisArg, arr[i], i, arr)) {
//       return false;
//     }
//   }
//   return true;
// }

Array.prototype.myEvery = function (callback, thisArg) {
  const arr = this
  if (typeof callback !== 'function') {
    throw new TypeError(callback + 'is not a function')
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr.hasOwnProperty(i) && !callback.call(thisArg, arr[i], i, arr)) {
      return false 
    }
  }
  return true
}