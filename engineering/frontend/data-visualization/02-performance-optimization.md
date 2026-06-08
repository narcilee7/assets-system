# 性能优化

## 1. 大数据量渲染策略

```
数据量       渲染策略
─────────────────────────────────────────
< 1,000      全量渲染（任意技术）
1K ~ 10K     全量 Canvas/SVG + 事件委托
10K ~ 100K   Canvas + 视口裁剪 + 简化绘制
100K ~ 1M    WebGL / Canvas + 数据聚合
> 1M         WebGL + LOD + 服务端预聚合
```

## 2. 虚拟化（Viewport Clipping）

```javascript
class VirtualizedChart {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = [];
    this.viewport = { x: 0, y: 0, width: 800, height: 400 };
  }

  // 只渲染视口内的数据
  renderVisibleData() {
    const { ctx, viewport, data } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 计算可见数据索引范围
    const startIndex = Math.floor(this._dataIndexAtX(viewport.x));
    const endIndex = Math.ceil(this._dataIndexAtX(viewport.x + viewport.width));

    // 只渲染可见部分
    for (let i = Math.max(0, startIndex); i <= Math.min(data.length - 1, endIndex); i++) {
      this._renderDataPoint(data[i], i);
    }
  }

  // 平移时重新计算可见范围
  pan(deltaX) {
    this.viewport.x += deltaX;
    this.renderVisibleData();
  }

  // 缩放时调整采样密度
  zoom(scale) {
    this.viewport.scale = scale;

    // 如果缩放后数据点太密，使用聚合
    if (scale < 0.1) {
      this.renderData = this._aggregateData(this.data, 10); // 每10个点聚合成1个
    } else {
      this.renderData = this.data;
    }

    this.renderVisibleData();
  }

  _aggregateData(data, bucketSize) {
    const aggregated = [];
    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize);
      aggregated.push({
        x: bucket[0].x,
        min: Math.min(...bucket.map((d) => d.y)),
        max: Math.max(...bucket.map((d) => d.y)),
        avg: bucket.reduce((sum, d) => sum + d.y, 0) / bucket.length,
      });
    }
    return aggregated;
  }
}
```

## 3. 增量渲染

```javascript
class IncrementalRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pendingChunks = [];
    this.isRendering = false;
  }

  // 分块渲染，避免阻塞主线程
  async render(data, chunkSize = 1000) {
    // 清空
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 分块
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    // 逐块渲染，每块之间让出主线程
    for (const chunk of chunks) {
      await this._renderChunk(chunk);
      await this._yieldToMainThread();
    }
  }

  _renderChunk(chunk) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        for (const point of chunk) {
          this._drawPoint(point);
        }
        resolve();
      });
    });
  }

  _yieldToMainThread() {
    return new Promise((resolve) => {
      setTimeout(resolve, 0); // 让出主线程处理用户输入
    });
  }
}
```

## 4. 离屏渲染（Offscreen Canvas）

```javascript
class OffscreenChart {
  constructor(canvas) {
    this.mainCanvas = canvas;
    this.mainCtx = canvas.getContext('2d');

    // 创建离屏画布
    this.offscreen = new OffscreenCanvas(canvas.width, canvas.height);
    this.offCtx = this.offscreen.getContext('2d');

    // 缓存静态内容
    this.cached = false;
  }

  // 在离屏画布上绘制（不阻塞主线程）
  async renderToOffscreen(data) {
    // 使用 Worker 进行离屏渲染
    const worker = new Worker('chart-worker.js');

    worker.postMessage(
      {
        canvas: this.offscreen,
        data,
      },
      [this.offscreen] // Transfer ownership
    );

    return new Promise((resolve) => {
      worker.onmessage = () => {
        // 将离屏结果复制到主画布
        this.mainCtx.drawImage(this.offscreen, 0, 0);
        resolve();
      };
    });
  }

  // Worker 中渲染
  // chart-worker.js
  self.onmessage = function (event) {
    const { canvas, data } = event.data;
    const ctx = canvas.getContext('2d');

    // 耗时渲染操作
    for (const point of data) {
      ctx.fillRect(point.x, point.y, 2, 2);
    }

    self.postMessage('done');
  };
}
```

## 5. LOD（Level of Detail）

```javascript
class LODChart {
  constructor() {
    this.levels = new Map();
  }

  // 预计算多个精度层级
  buildLOD(data) {
    const maxLevel = Math.ceil(Math.log2(data.length));

    for (let level = 0; level <= maxLevel; level++) {
      const step = Math.pow(2, level);
      const simplified = [];

      for (let i = 0; i < data.length; i += step) {
        const window = data.slice(i, i + step);
        simplified.push({
          x: window[0].x,
          y: window.reduce((sum, d) => sum + d.y, 0) / window.length,
          min: Math.min(...window.map((d) => d.y)),
          max: Math.max(...window.map((d) => d.y)),
        });
      }

      this.levels.set(level, simplified);
    }
  }

  // 根据缩放级别选择数据
  getDataForZoom(zoom) {
    // zoom 越大，使用越精细的数据
    const level = Math.max(0, Math.floor(Math.log2(zoom)));
    return this.levels.get(Math.min(level, this.levels.size - 1));
  }
}
```
