/**
 * 节流
 */
function throttle (fn, delay) {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (lastTime - now < delay) {
      return
    }
    lastTime = now
    fn.apply(this, args)
  }
}

