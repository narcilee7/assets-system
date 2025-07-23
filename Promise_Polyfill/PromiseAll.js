function MyPromiseAll(arr) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(arr)) {
      reject(new TypeError('Argument must be an array'))
      return
    }
    if (arr.length === 0) {
      resolve([])
      return
    }

    let resolveCount = 0
    const result = new Array(arr.length)

    arr.forEach((promise, index) => {
      Promise.resolve(promise)
        .then(v => {
          result[index] = v
          resolveCount += 1
          if (resolveCount === arr.length) {
            resolve(result)
          }
        })
        .catch(err => {
          reject(err)
        })
    })
  })
}

async function main() {
  const PromiseArr = [
    Promise.resolve(1),
    Promise.reject(2),
    Promise.resolve(3)
  ]

  try {
    const res = await MyPromiseAll(PromiseArr)
    console.log('res', res)
  } catch (err) {
    console.error('MyPromiseAll error:', err)
  }

  try {
    const realRes = await Promise.all(PromiseArr)
    console.log('realRes', realRes)
  } catch (err) {
    console.error('Promise.all error:', err)
  }
}

main()
