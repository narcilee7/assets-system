# 手写前端向量检索引擎

## 目标

实现一个简化版前端向量检索引擎，支持：
1. 余弦相似度计算
2. 暴力搜索（小规模）
3. HNSW 近似最近邻（大规模）
4. 向量缓存与持久化

## 实现

```javascript
// vector-search.js

/**
 * 向量工具函数
 */
class VectorUtils {
  // 余弦相似度
  static cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // 欧氏距离
  static euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // 向量归一化
  static normalize(vec) {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return norm === 0 ? vec : vec.map((v) => v / norm);
  }
}

/**
 * 暴力向量检索（适合 < 10000 条数据）
 */
class BruteForceVectorSearch {
  constructor(dimension, metric = 'cosine') {
    this.dimension = dimension;
    this.metric = metric;
    this.vectors = [];  // { id, vector, metadata }
  }

  add(id, vector, metadata = {}) {
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: ${vector.length} != ${this.dimension}`);
    }
    this.vectors.push({ id, vector, metadata });
  }

  search(queryVector, topK = 5) {
    if (queryVector.length !== this.dimension) {
      throw new Error(`Query dimension mismatch`);
    }

    const scores = this.vectors.map((item) => ({
      ...item,
      score: this.metric === 'cosine'
        ? VectorUtils.cosineSimilarity(queryVector, item.vector)
        : -VectorUtils.euclideanDistance(queryVector, item.vector),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  delete(id) {
    this.vectors = this.vectors.filter((v) => v.id !== id);
  }

  size() {
    return this.vectors.length;
  }
}

/**
 * 简化版 HNSW（Hierarchical Navigable Small World）
 * 适合中等规模数据（10000-100000 条）
 */
class HNSWIndex {
  constructor(dimension, options = {}) {
    this.dimension = dimension;
    this.M = options.M || 16;           // 每个节点的最大连接数
    this.efConstruction = options.efConstruction || 200;
    this.efSearch = options.efSearch || 50;
    this.metric = options.metric || 'cosine';

    this.nodes = new Map();              // id → { vector, neighbors: [level][neighborIds] }
    this.entryPoint = null;
    this.maxLevel = 0;
    this.levelMultiplier = 1 / Math.log(this.M);
  }

  // 随机生成层级
  _randomLevel() {
    let level = 0;
    while (Math.random() < this.levelMultiplier && level < this.maxLevel + 1) {
      level++;
    }
    return level;
  }

  // 计算距离
  _distance(a, b) {
    if (this.metric === 'cosine') {
      return 1 - VectorUtils.cosineSimilarity(a, b);  // 转为距离
    }
    return VectorUtils.euclideanDistance(a, b);
  }

  add(id, vector, metadata = {}) {
    if (vector.length !== this.dimension) {
      throw new Error('Dimension mismatch');
    }

    const level = this._randomLevel();
    const node = {
      id,
      vector,
      metadata,
      neighbors: Array.from({ length: level + 1 }, () => []),
    };

    if (this.nodes.size === 0) {
      this.entryPoint = id;
      this.maxLevel = level;
      this.nodes.set(id, node);
      return;
    }

    // 从最高层开始搜索
    let currentId = this.entryPoint;
    let currentDist = this._distance(vector, this.nodes.get(currentId).vector);

    for (let l = this.maxLevel; l > level; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const neighbors = this.nodes.get(currentId).neighbors[l] || [];
        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          const dist = this._distance(vector, neighbor.vector);
          if (dist < currentDist) {
            currentDist = dist;
            currentId = neighborId;
            changed = true;
          }
        }
      }
    }

    // 在目标层级及以下插入连接
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this._searchLayer(vector, currentId, l, this.efConstruction);
      const nearest = candidates.slice(0, this.M);
      node.neighbors[l] = nearest.map((n) => n.id);

      // 双向连接
      for (const near of nearest) {
        const nearNode = this.nodes.get(near.id);
        nearNode.neighbors[l] = nearNode.neighbors[l] || [];
        nearNode.neighbors[l].push(id);

        // 如果连接过多，收缩
        if (nearNode.neighbors[l].length > this.M * 2) {
          const sorted = nearNode.neighbors[l]
            .map((nid) => ({
              id: nid,
              dist: this._distance(nearNode.vector, this.nodes.get(nid).vector),
            }))
            .sort((a, b) => a.dist - b.dist);
          nearNode.neighbors[l] = sorted.slice(0, this.M).map((n) => n.id);
        }
      }

      currentId = candidates[0].id;
    }

    this.nodes.set(id, node);

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPoint = id;
    }
  }

  _searchLayer(queryVector, entryId, level, ef) {
    const visited = new Set([entryId]);
    const candidates = [{ id: entryId, dist: this._distance(queryVector, this.nodes.get(entryId).vector) }];
    const results = [...candidates];

    while (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      const current = candidates.shift();

      const farthestResult = results[results.length - 1];
      if (current.dist > farthestResult.dist && results.length >= ef) {
        break;
      }

      const node = this.nodes.get(current.id);
      const neighbors = node.neighbors[level] || [];

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighbor = this.nodes.get(neighborId);
        const dist = this._distance(queryVector, neighbor.vector);

        if (dist < farthestResult.dist || results.length < ef) {
          candidates.push({ id: neighborId, dist });
          results.push({ id: neighborId, dist });
          results.sort((a, b) => a.dist - b.dist);
          if (results.length > ef) results.pop();
        }
      }
    }

    return results;
  }

  search(queryVector, topK = 5) {
    if (this.nodes.size === 0) return [];

    let currentId = this.entryPoint;

    // 从最高层下降到第 0 层
    for (let l = this.maxLevel; l > 0; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const node = this.nodes.get(currentId);
        const neighbors = node.neighbors[l] || [];

        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          const dist = this._distance(queryVector, neighbor.vector);
          const currentDist = this._distance(queryVector, node.vector);

          if (dist < currentDist) {
            currentId = neighborId;
            changed = true;
          }
        }
      }
    }

    // 在第 0 层精确搜索
    const results = this._searchLayer(queryVector, currentId, 0, this.efSearch);

    return results
      .slice(0, topK)
      .map((r) => {
        const node = this.nodes.get(r.id);
        return {
          id: node.id,
          vector: node.vector,
          metadata: node.metadata,
          score: this.metric === 'cosine' ? 1 - r.dist : -r.dist,
        };
      });
  }
}

// ========== 使用示例 ==========

// 1. 暴力搜索（小规模）
const bfSearch = new BruteForceVectorSearch(384, 'cosine');

bfSearch.add('doc1', [0.1, 0.2, /* ... 384 dims ... */], { title: 'Hello' });
bfSearch.add('doc2', [0.3, 0.4, /* ... */], { title: 'World' });

const results = bfSearch.search([0.15, 0.25, /* ... */], 3);
console.log(results);

// 2. HNSW 搜索（大规模）
const hnsw = new HNSWIndex(384, { M: 16, efConstruction: 200 });

// 批量添加
for (let i = 0; i < 10000; i++) {
  const vector = Array.from({ length: 384 }, () => Math.random() - 0.5);
  hnsw.add(`doc-${i}`, vector, { index: i });
}

// 搜索
const query = Array.from({ length: 384 }, () => Math.random() - 0.5);
const hnswResults = hnsw.search(query, 5);
console.log('HNSW results:', hnswResults);

module.exports = { VectorUtils, BruteForceVectorSearch, HNSWIndex };
```
