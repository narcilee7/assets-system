class IncrementalRenderer {
  cosntructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pendingChunks = [];
    this.isRendering = false;
  }

  async render(data, chunkSize = 1000) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      await this._renderChunk(chunk);
      await this._yieldToMainThread();
    }
  }

  _renderChunk(chunk) {
    return new Promise((resolve()) => {
      requestAnimationFrame(() => {
        for (const point of chunk) {
          this._drawPoint(point);
        }
        resolve();
      })
    })
  }
  
_yieldToMainThread() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve
    }, 0);
  })
}
}