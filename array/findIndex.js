// Array.prototype.myFindIndex = function (callback, thisArg) { 
//   const arr = this;
//   for (let i = 0; i < arr.length; i++) {
//     if (arr.hasOwnProperty(i)) {
//       if (callback.call(thisArg, arr[i], i, arr)) {
//         return i;
//       }
//     }
//   }
//   return -1;
// }

Array.prototype.find_index = function (callback, thisArg) {
  const arr = this
  for (let i = 0; i < arr.length; i++) {
    if (arr.hasOwnProperty(i)) {
      if (callback.call(thisArg, arr[i], i, arr)) {
        return i
      }
    }
  }
  return -1
}