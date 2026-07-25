class ProgressiveScheduler {
  async process(items, processor, options = {}) {
    const { chunkSize = 100, onProgress, onComplete } = options;
    const results = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      // 处理当前块
      const chunkResults = chunk.map(processor);
      results.push(...chunkResults);

      // 报告进度
      if (onProgress) {
        onProgress({
          processed: Math.min(i + chunkSize, items.length),
          total: items.length,
          percentage: Math.round(((i + chunkSize) / items.length) * 100),
        });
      }

      // 让出主线程
      await this.yield();
    }

    if (onComplete) {
      onComplete(results);
    }

    return results;
  }

  yield() {
    return new Promise((resolve) => {
      // 优先使用 scheduler.yield（Chrome 115+）
      if (typeof scheduler !== "undefined" && scheduler.yield) {
        scheduler.yield().then(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}
