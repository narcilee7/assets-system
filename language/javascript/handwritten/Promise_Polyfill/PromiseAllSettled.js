// function MyPromiseAllSettled(promises) {
//   return new Promise((resolve, reject) => {
//     if (!Array.isArray(promises)) {
//       reject(new TypeError('Argument must be an array'));
//       return;
//     }

//     if (promises.length === 0) {
//       resolve([]);
//       return;
//     }

//     const results = new Array(promises.length)
//     let settledCount = 0

//     promises.forEach((promise, index) => {
//       Promise.resolve(promise)
//         .then(value => {
//           results[index] = { status: 'fulfilled', value }
//         })
//         .catch(reason => {
//           results[index] = { status: 'rejected', reason }
//         })
//         .finally(() => {
//           settledCount += 1
//           if (settledCount === promises.length) {
//             resolve(results)
//           }
//         })
//     })
//   })
// }

function MyPromiseALlSettled(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      reject(new TypeError('Argument must be an array'))
      return
    }
    if (promises.length === 0) {
      resolve([])
    }

    const results = new Array(promises.length)
    let settledCount = 0

    promises.forEach((p, idx) => {
      Promise.resolve(p)
        .then(value => {
          results[idx] = { status: 'fulfilled', value }
        })
        .catch(reason => {
          results[idx] = { status: 'rejected', reason }
        })
        .finally(() => {
          settledCount += 1
          if (settledCount === promises.length) {
            resolve(results)
          }
        })
    })
  })
}

async function main() {
  const promises = [
    Promise.resolve(1),
    Promise.reject(new Error('Error')),
    Promise.resolve(3)
  ];

  try {
    const myRes = await MyPromiseAllSettled(promises);
    const expectedRes = await Promise.allSettled(promises);
    console.log(myRes);
    console.log(expectedRes);
    console.log(JSON.stringify(myRes) === JSON.stringify(expectedRes)); // true
  } catch (error) {
    console.error(error);
  }
}

main()