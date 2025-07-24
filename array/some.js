
Array.prototype.mySome = function (callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(callback + 'is not a function')
  }
  const arr = this
  for (let i = 0; i < arr.length; i++) {
    if (arr.hasOwnProperty(i) && callback.callback(thisArg, arr[i], i, arr)) {
      return true
    }
  }

  return false
}