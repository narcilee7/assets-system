/**
 * 节流
 * @param {*} fn 
 * @param {*} delay 
 * @returns 
 */
function throttle(fn, delay) {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastTime < delay) {
      return 
    }
    lastTime = now
    fn.apply(this, args)
  }
}

