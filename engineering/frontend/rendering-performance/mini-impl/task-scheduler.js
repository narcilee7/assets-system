class TaskScheduler {
  constructor(options = {}) {
    this.frameBudget = options.frameBudget || 16;
    this.tasks = [];
    this.isRunning = false;
  }

  add(task, priority = "normal") {
    const priorities = { height: 0, normal: 1, low: 2 };
    this.tasks.push({
      fn: task,
      priority: priorities[priority],
    });
    this.tasks.sort((a, b) => a.priority - b.priority);
    this.schedule();
  }

  schedule() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    requestAnimationFrame((frameStartTime) => {
      this.runTasks(frameStartTime);
    });
  }

  runTasks(frameStartTime) {
    while (this.tasks.length > 0) {
      const elapsed = performance.now() - frameStartTime;
      if (elapsed >= this.frameBudget) {
        requestAnimationFrame((nextFrameStart) => {
          this.runTasks(nextFrameStart);
        });
        return;
      }

      const task = this.tasks.shift();
      try {
        task.fn();
      } catch (error) {
        console.error(error);
      }
    }

    this.isRunning = false;
  }

  clear() {
    this.tasks = [];
    this.isRunning = false;
  }
}
