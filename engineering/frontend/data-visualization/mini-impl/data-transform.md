# 手写数据变换管道

## 目标

实现一个简化版数据变换管道，支持：
1. Scale（线性/对数/时间/序数）
2. Axis（刻度生成）
3. Layout（堆叠/分组/饼图布局）
4. 数据预处理（排序、过滤、聚合）

## 实现

```javascript
// data-transform.js

/**
 * 比例尺：将数据域映射到像素范围
 */
class Scale {
  constructor(domain, range) {
    this.domain = domain;
    this.range = range;
  }
}

class LinearScale extends Scale {
  constructor(domain, range) {
    super(domain, range);
  }

  scale(value) {
    const [d0, d1] = this.domain;
    const [r0, r1] = this.range;
    const t = (value - d0) / (d1 - d0);
    return r0 + t * (r1 - r0);
  }

  invert(pixel) {
    const [d0, d1] = this.domain;
    const [r0, r1] = this.range;
    const t = (pixel - r0) / (r1 - r0);
    return d0 + t * (d1 - d0);
  }

  ticks(count = 5) {
    const [min, max] = this.domain;
    const step = (max - min) / count;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(min + step * i);
    }
    return ticks;
  }

  nice() {
    const [min, max] = this.domain;
    const step = this._niceStep(max - min);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    this.domain = [niceMin, niceMax];
    return this;
  }

  _niceStep(range) {
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * Math.pow(10, exponent);
  }
}

class BandScale extends Scale {
  constructor(domain, range) {
    super(domain, range);
    this.bandwidth = 0;
    this._recalculate();
  }

  _recalculate() {
    const [r0, r1] = this.range;
    const totalRange = r1 - r0;
    this.bandwidth = totalRange / this.domain.length;
    this.step = this.bandwidth;
    this.padding = 0;
  }

  scale(value) {
    const index = this.domain.indexOf(value);
    if (index === -1) return 0;
    const [r0] = this.range;
    return r0 + index * this.step + this.padding / 2;
  }

  bandwidth() {
    return this.step - this.padding;
  }
}

class TimeScale extends Scale {
  constructor(domain, range) {
    super(domain, range);
  }

  scale(date) {
    const d = date instanceof Date ? date : new Date(date);
    const [d0, d1] = this.domain.map((d) => (d instanceof Date ? d : new Date(d)));
    const [r0, r1] = this.range;
    const t = (d.getTime() - d0.getTime()) / (d1.getTime() - d0.getTime());
    return r0 + t * (r1 - r0);
  }

  ticks(count = 5) {
    const [d0, d1] = this.domain.map((d) => (d instanceof Date ? d : new Date(d)));
    const step = (d1.getTime() - d0.getTime()) / count;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(new Date(d0.getTime() + step * i));
    }
    return ticks;
  }
}

/**
 * 布局引擎
 */
class Layout {
  static stack(data, keys) {
    const stacked = data.map((d) => {
      let y0 = 0;
      const result = { ...d };
      keys.forEach((key) => {
        result[`${key}_y0`] = y0;
        result[`${key}_y1`] = y0 + d[key];
        y0 += d[key];
      });
      return result;
    });

    const maxTotal = Math.max(...stacked.map((d) => {
      return keys.reduce((sum, key) => sum + d[key], 0);
    }));

    return { data: stacked, max: maxTotal };
  }

  static group(data, keys, groupWidth = 0.8) {
    const barWidth = groupWidth / keys.length;
    const grouped = data.map((d) => {
      const result = { ...d };
      keys.forEach((key, i) => {
        result[`${key}_offset`] = (i - keys.length / 2 + 0.5) * barWidth;
        result[`${key}_width`] = barWidth;
      });
      return result;
    });

    const maxValue = Math.max(...data.map((d) => Math.max(...keys.map((k) => d[k]))));

    return { data: grouped, max: maxValue, barWidth };
  }

  static pie(data, valueKey) {
    const total = data.reduce((sum, d) => sum + d[valueKey], 0);
    let currentAngle = 0;

    return data.map((d) => {
      const angle = (d[valueKey] / total) * Math.PI * 2;
      const result = {
        ...d,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        padAngle: 0.02,
      };
      currentAngle += angle;
      return result;
    });
  }

  static arc(x, y, radius, startAngle, endAngle) {
    const startX = x + radius * Math.cos(startAngle - Math.PI / 2);
    const startY = y + radius * Math.sin(startAngle - Math.PI / 2);
    const endX = x + radius * Math.cos(endAngle - Math.PI / 2);
    const endY = y + radius * Math.sin(endAngle - Math.PI / 2);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return `M ${x} ${y} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
  }
}

/**
 * 数据预处理
 */
class DataTransform {
  static sort(data, key, order = 'asc') {
    return [...data].sort((a, b) => {
      if (order === 'asc') return a[key] - b[key];
      return b[key] - a[key];
    });
  }

  static filter(data, predicate) {
    return data.filter(predicate);
  }

  static aggregate(data, groupBy, aggFns) {
    const groups = new Map();

    for (const item of data) {
      const key = item[groupBy];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    return Array.from(groups.entries()).map(([key, items]) => {
      const result = { [groupBy]: key };
      for (const [field, fn] of Object.entries(aggFns)) {
        const values = items.map((d) => d[field]);
        result[field] = fn(values);
      }
      return result;
    });
  }

  static bin(data, key, binCount = 10) {
    const values = data.map((d) => d[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      x0: min + i * step,
      x1: min + (i + 1) * step,
      count: 0,
      items: [],
    }));

    for (const item of data) {
      const value = item[key];
      const binIndex = Math.min(Math.floor((value - min) / step), binCount - 1);
      bins[binIndex].count++;
      bins[binIndex].items.push(item);
    }

    return bins;
  }

  static normalize(data, key) {
    const values = data.map((d) => d[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return data.map((d) => ({
      ...d,
      [`${key}_normalized`]: (d[key] - min) / range,
    }));
  }
}

// 使用示例
const data = [
  { category: 'A', value1: 10, value2: 20 },
  { category: 'B', value1: 30, value2: 15 },
  { category: 'C', value1: 20, value2: 25 },
];

// 线性比例尺
const yScale = new LinearScale([0, 50], [0, 300]).nice();
console.log(yScale.scale(25));  // 150
console.log(yScale.ticks());    // [0, 10, 20, 30, 40, 50]

// 序数比例尺
const xScale = new BandScale(['A', 'B', 'C'], [0, 600]);
console.log(xScale.scale('B'));  // 200

// 堆叠布局
const stacked = Layout.stack(data, ['value1', 'value2']);
console.log(stacked.data[0].value1_y0); // 0
console.log(stacked.data[0].value1_y1); // 10

// 分组布局
const grouped = Layout.group(data, ['value1', 'value2']);

// 饼图布局
const pie = Layout.pie(data, 'value1');
console.log(pie[0].startAngle); // 0

// 数据聚合
const aggregated = DataTransform.aggregate(data, 'category', {
  value1: (vals) => vals.reduce((a, b) => a + b, 0),
  value2: (vals) => vals.reduce((a, b) => a + b, 0),
});

module.exports = { LinearScale, BandScale, TimeScale, Layout, DataTransform };
```
