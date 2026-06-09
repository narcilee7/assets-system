# 资源监控

## 1. 资源加载分析

```javascript
// 分析所有资源加载情况
function analyzeResources() {
  const resources = performance.getEntriesByType('resource');

  return resources.map((r) => ({
    name: r.name,
    type: r.initiatorType,
    duration: Math.round(r.duration),
    dns: Math.round(r.domainLookupEnd - r.domainLookupStart),
    tcp: Math.round(r.connectEnd - r.connectStart),
    ssl: r.secureConnectionStart > 0
      ? Math.round(r.connectEnd - r.secureConnectionStart)
      : 0,
    ttfb: Math.round(r.responseStart - r.startTime),
    download: Math.round(r.responseEnd - r.responseStart),
    size: r.transferSize,
    cache: r.transferSize === 0 ? 'memory/disk' : 'network',
  }));
}

// 找出慢资源
function findSlowResources(threshold = 1000) {
  return analyzeResources().filter((r) => r.duration > threshold);
}

// 找出大资源
function findLargeResources(threshold = 500 * 1024) {
  return analyzeResources().filter((r) => r.size > threshold);
}
```

## 2. CDN 效果监控

```javascript
// 比较 CDN vs 源站加载时间
function analyzeCDN() {
  const resources = performance.getEntriesByType('resource');

  const cdnResources = resources.filter((r) =>
    r.name.includes('cdn.example.com')
  );

  return {
    totalCDN: cdnResources.length,
    avgDuration: average(cdnResources.map((r) => r.duration)),
    cacheHitRate: cdnResources.filter((r) => r.transferSize === 0).length / cdnResources.length,
    // CDN 通常 transferSize === 0 表示缓存命中（从 disk/memory cache 读取）
  };
}
```

## 3. 缓存分析

```javascript
// 分析缓存命中率
function analyzeCache() {
  const resources = performance.getEntriesByType('resource');

  const stats = {
    total: resources.length,
    memoryCache: 0,
    diskCache: 0,
    network: 0,
  };

  for (const r of resources) {
    // transferSize === 0 且 decodedBodySize > 0：缓存命中
    // deliveryType: 'cache' (Chrome 122+)
    if (r.deliveryType === 'cache') {
      stats.memoryCache++;
    } else if (r.transferSize === 0 && r.decodedBodySize > 0) {
      stats.diskCache++;
    } else {
      stats.network++;
    }
  }

  stats.hitRate = (stats.memoryCache + stats.diskCache) / stats.total;
  return stats;
}
```

## 4. 瀑布图数据采集

```javascript
// 生成瀑布图数据（用于可视化）
function generateWaterfallData() {
  const startTime = performance.timeOrigin;

  return performance.getEntriesByType('resource').map((r) => ({
    name: r.name.split('/').pop() || r.name,
    fullUrl: r.name,
    type: r.initiatorType,
    start: Math.round(r.startTime),
    dns: [r.domainLookupStart, r.domainLookupEnd],
    tcp: [r.connectStart, r.connectEnd],
    ssl: r.secureConnectionStart > 0
      ? [r.secureConnectionStart, r.connectEnd]
      : null,
    request: [r.requestStart, r.responseStart],
    response: [r.responseStart, r.responseEnd],
    duration: Math.round(r.duration),
    size: r.transferSize,
  }));
}
```
