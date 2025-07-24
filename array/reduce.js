Array.prototype.myReduce = function (callback, initValue) {
  const arr = this
  let acc = initValue
  let i = 0
  if (acc === undefined) {
    acc = arr[0]
    i = 1
  }
  for (; i < arr.length; i++) {
    if (arr.hasOwnProperty(i)) {
      acc = callback(acc, arr[i], i, arr)
    }
  }
  return acc
}

const arr = [1, 2, 3, 4, 5]
console.log(arr.myReduce((acc, cur) => acc + cur, 0))
