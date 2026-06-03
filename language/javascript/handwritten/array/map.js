/**
 * map
 * 遍历数组，返回新数组，包含回调函数的结果
 */
Array.prototype.my_map = function (callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + 'is not a function')
  }
  const arr = this
  const result = []
  for (let i = 0; i < arr.length; i++) {
    if (arr.hasOwnProperty(i)) {
      result[i] = callback.call(thisArg, arr[i], i, arr);
    }
  }
  return result
}