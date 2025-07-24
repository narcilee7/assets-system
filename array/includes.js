Array.prototype.myInclude = function (value, fromIndex = 0) {
  const arr = this 
  const len = arr.length
  let i = fromIndex >= 0 ? fromIndex : len + fromIndex
  while (i < len) {
    if (arr[i] === value || (Number.isNaN(arr[i]) && Number.isNaN(value))) {
      return true
    }
    i++
  }
  return false
}