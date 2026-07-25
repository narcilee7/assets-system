class IdleScheduler {
  constructor(options = {}) {
    this.timeout = options.timeout || 2000;
    this.tasks = [];
  }

  add(task) {
    this.tasks.push(task);
    this.schedule();
  }

  schedule() {
    if (this.tasks.length === 0) {
      return;
    }

    requestIdleCallback(
      (deadline) => {
        while (
          (deadline.timeRemaining() > 0 || deadline.didTimeout) &&
          this.tasks.length > 0
        ) {
          const task = this.tasks.shift();
          task();
        }
        if (this.tasks.length > 0) {
          this.schedule();
        }
      },
      { timeout: this.timeout },
    );
  }
}
