class EventEmitter {
  constructor() {
    this.cached = {}
  }

  on(event, obj) {
    if (!this.cached[event]) {
      // 初始化
      this.cached[event] = []
    }
    this.cached[event].push(obj)
  }
  
  emit(event, ...args) {
    if (this.cached[event]) {
      this.cached[event].forEach(obj => obj(...args))
    }
  }

  off(event, obj) {
    if (!this.cached[event]) return 

    if (!obj) {
      delete this.cached[event]
    } else {
      this.cached[event] = this.cached[event].filter(callback => obj !== callback)
    }
  }

  once(event, obj) {
    const wrapper = (...args) => {
      obj(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
}