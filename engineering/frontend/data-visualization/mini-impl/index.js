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
