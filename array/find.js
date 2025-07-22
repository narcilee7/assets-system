// Array.prototype.myFind = function (callback, thisArg) {
//   const arr = this;
//   for (let i = 0; i < arr.length; i++) {
//     if (arr.hasOwnProperty(i) && callback(arr[i], i, arr)) {
//       return arr[i];
//     }
//   }
//   return undefined;
// }

Array.prototype.MyFind = function(callback, thisArg) {
  const arr = this
  for (let i = 0; i < arr.length; i++) {
    if (arr.hasOwnProperty(i) && callback(arr[i], i, arr)) {
      return arr[i]
    }
  }
  return undefined
}
