console.log('script start') // 1 sync 

setTimeout(() => {
    console.log('setTimeout') // 9 宏任务
}, 0);

async function async1() {
    console.log('async1 start') // 2 sync
    await async2()
    console.log('async1 end') // 5 微任务 a1
}

async function async2() {
    // 这里会打印 async2，但是不会阻塞 async1 的执行
    console.log('async2') // 3 sync 
}

async1()

new Promise((resolve) => {
    console.log('promise1') // 4 sync
    resolve()
}).then(() => {
    console.log('promise2') // 8 微任务
})

console.log('script end') // 7 sync