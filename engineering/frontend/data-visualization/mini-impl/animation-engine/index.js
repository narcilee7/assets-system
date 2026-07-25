class AnimationEngine {
  constructor() {
    this.animations = new Map();
    this.running = false;
  }

  animate(elId, from, to, duration, easing, onUpdate) {
    const startTime = performance.now();
    const id = `${elId}_${Date.now()}`;

    this.animations.set(id, {
      elId,
      from,
      to,
      duration,
      easing,
      onUpdate,
      startTime,
    });

    if (!this.running) {
      this.running = true;
      this._tick();
    }

    return {
      cancel: () => this.animations.delete(id);
    };
  }

  _tick() {
    const now = performance.now();
    const completed = [];

    for (const [id, anim] of this.animations) {
      const elapsed = now - anim.startTime;
      const progress
    }
  }
}