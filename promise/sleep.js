const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const main = async () => {
    console.log('start')
    await sleep(1000)
    // 下面的都会阻塞，直到sleep执行完
    console.log('end')
}

main()