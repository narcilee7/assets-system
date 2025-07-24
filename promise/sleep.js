// // function mySetTimeout(callback, delay) {
// //   return new Promise((resolve, reject) => {
// //     setTimeout(() => {
// //       resolve(callback());
// //     }, delay);
// //   });
// // }

// function sleep(callback, delay) {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       resolve(callback())
//     }, delay);
//   })
// }

function sleep(callback, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(callback())
    }, delay)
  })
}

