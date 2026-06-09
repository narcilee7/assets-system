# 动画引擎

## 1. 动画调度系统

```javascript
class AnimationEngine {
  constructor() {
    this.animations = new Map();
    this.running = false;
  }

  animate(elementId, from, to, duration, easing, onUpdate) {
    const startTime = performance.now();
    const id = `${elementId}_${Date.now()}`;

    this.animations.set(id, {
      elementId,
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
      cancel: () => this.animations.delete(id),
    };
  }

  _tick() {
    const now = performance.now();
    const completed = [];

    for (const [id, anim] of this.animations) {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);
      const eased = anim.easing(progress);

      // 插值
      const current = {};
      for (const key of Object.keys(anim.from)) {
        current[key] = anim.from[key] + (anim.to[key] - anim.from[key]) * eased;
      }

      anim.onUpdate(current);

      if (progress >= 1) {
        completed.push(id);
      }
    }

    // 清理已完成动画
    completed.forEach((id) => this.animations.delete(id));

    if (this.animations.size > 0) {
      requestAnimationFrame(() => this._tick());
    } else {
      this.running = false;
    }
  }
}
```

## 2. 缓动函数

```javascript
const Easing = {
  // 线性
  linear: (t) => t,

  // 二次
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  // 三次
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // 弹性
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  // 弹簧
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
```

## 3. FLIP 动画（布局变化）

```javascript
class FLIPAnimator {
  // First: 记录初始状态
  // Last: 计算最终状态
  // Invert: 计算差值并应用反向变换
  // Play: 执行动画到最终状态

  async animate(element, getFinalState) {
    // 1. First: 记录初始位置
    const first = element.getBoundingClientRect();

    // 2. 应用最终状态（不带动画）
    getFinalState();

    // 3. Last: 记录最终位置
    const last = element.getBoundingClientRect();

    // 4. Invert: 计算差值
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    const deltaW = first.width / last.width;
    const deltaH = first.height / last.height;

    // 5. 应用反向变换（让元素看起来还在原位置）
    element.style.transition = 'none';
    element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;

    // 强制重排
    element.getBoundingClientRect();

    // 6. Play: 移除变换，触发动画
    requestAnimationFrame(() => {
      element.style.transition = 'transform 0.3s ease-out';
      element.style.transform = '';
    });
  }
}

// 使用：柱状图排序动画
flipAnimator.animate(barElement, () => {
  // 改变 DOM 顺序或样式
  barElement.style.order = newIndex;
});
```

## 4. 图表过渡动画

```javascript
class ChartTransition {
  constructor(chart) {
    this.chart = chart;
    this.prevData = null;
  }

  // 数据更新时的过渡动画
  transitionTo(newData, duration = 500) {
    const oldData = this.prevData || newData.map(() => ({ value: 0 }));
    this.prevData = newData;

    const engine = new AnimationEngine();

    // 为每个数据点创建动画
    newData.forEach((d, i) => {
      const oldValue = oldData[i]?.value || 0;

      engine.animate(
        `bar-${i}`,
        { value: oldValue },
        { value: d.value },
        duration,
        Easing.easeOutCubic,
        (current) => {
          this.chart.updateBar(i, current.value);
        }
      );
    });
  }

  // 进入动画
  enter(elements, duration = 400) {
    elements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'scaleY(0)';
      el.style.transformOrigin = 'bottom';

      setTimeout(() => {
        el.style.transition = `all ${duration}ms ${Easing.easeOutCubic}`;
        el.style.opacity = '1';
        el.style.transform = 'scaleY(1)';
      }, i * 50); // 错开动画
    });
  }

  // 退出动画
  exit(elements, duration = 300) {
    return new Promise((resolve) => {
      let completed = 0;
      elements.forEach((el) => {
        el.style.transition = `all ${duration}ms ease-in`;
        el.style.opacity = '0';
        el.style.transform = 'scaleY(0)';

        setTimeout(() => {
          completed++;
          if (completed === elements.length) resolve();
        }, duration);
      });
    });
  }
}
```

## 5. 性能优化：减少重排

```javascript
class BatchAnimator {
  constructor() {
    this.updates = new Map();
    this.scheduled = false;
  }

  update(element, styles) {
    this.updates.set(element, { ...this.updates.get(element), ...styles });
    this._schedule();
  }

  _schedule() {
    if (this.scheduled) return;
    this.scheduled = true;

    requestAnimationFrame(() => {
      // 一次性应用所有样式更新
      for (const [element, styles] of this.updates) {
        Object.assign(element.style, styles);
      }
      this.updates.clear();
      this.scheduled = false;
    });
  }
}
```
