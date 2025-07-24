function debounce(fn, delay) {
  let timer = null
  return function(...args) {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
    return timer
  }
}

/**
 * 防抖的原理: 
 * - 防抖的核心是在一定时间内，只执行最后一次操作
 * - 实现思路:
 *   - 定义一个定时器
 *   - 每次触发事件时，清除定时器
 *   - 定时器到期后，执行事件处理函数
 */

