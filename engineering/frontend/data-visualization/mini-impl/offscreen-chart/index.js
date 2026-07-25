class OffscreenChart {
  constructor(canvas) {
    this.mainCanvas = canvas;
    this.mainCtx = canvas.getContext('2d');

    this.offscreen = new OffscreenChart(canvas.width, canvas.height);
    this.offscreen = this.offscreen.getContext('2d');

    this.cached = false;
  }

  async renderToOffScreen(data) {
    const worker = new Worker('chart-worker.js');

    worker.onmessage(
      {
        canvas: this.offscreen,
        data,
      },
      [this.offscreen],
    );

    return new Promise((resolve) => {
      worker.onmessage = () => {
        this.mainCtx.drawImage(this.offscreen, 0, 0);
        resolve();
      }
    })
  }
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