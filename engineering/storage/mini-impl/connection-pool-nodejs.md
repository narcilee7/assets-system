# 手写数据库连接池（Node.js）

## 目标

实现一个简化版数据库连接池，支持：
1. 连接复用（基于 `mysql2` 或通用接口）
2. 最大/最小连接数控制
3. 连接超时获取
4. 空闲连接检测与回收
5. 连接泄漏检测
6. 连接健康检查

## 实现

```javascript
// connection-pool.js

const { EventEmitter } = require('events');

class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 数据库连接配置
    this.config = {
      host: options.host || 'localhost',
      port: options.port || 3306,
      user: options.user,
      password: options.password,
      database: options.database,
      ...options.connectionConfig,
    };
    
    // 池配置
    this.minIdle = options.minIdle || 2;
    this.maxActive = options.maxActive || 10;
    this.maxWaitMs = options.maxWaitMs || 30000;
    this.maxLifetime = options.maxLifetime || 1800000; // 30min
    this.idleTimeout = options.idleTimeout || 600000;  // 10min
    this.leakDetectionThreshold = options.leakDetectionThreshold || 0;
    this.validationQuery = options.validationQuery || 'SELECT 1';
    this.connectionFactory = options.connectionFactory; // 自定义连接工厂
    
    // 状态
    this.idleConnections = [];
    this.activeConnections = new Map(); // conn -> state
    this.totalConnections = 0;
    this.closed = false;
    
    // 等待队列
    this.waitQueue = [];
    
    // House keeping
    this.houseKeeperInterval = null;
    this._startHouseKeeper();
    
    // 初始化最小连接
    this._initialize();
  }

  async _initialize() {
    const creates = [];
    for (let i = 0; i < this.minIdle; i++) {
      creates.push(this._createConnection().catch(() => null));
    }
    const conns = await Promise.all(creates);
    for (const conn of conns) {
      if (conn) this.idleConnections.push(conn);
    }
  }

  // ========== 核心 API ==========

  async getConnection() {
    if (this.closed) {
      throw new Error('Pool is closed');
    }

    // 1. 尝试从空闲队列获取
    let conn = this._getIdleConnection();
    if (conn) {
      return this._checkout(conn);
    }

    // 2. 尝试创建新连接
    if (this.totalConnections < this.maxActive) {
      this.totalConnections++;
      try {
        conn = await this._createConnection();
        return this._checkout(conn);
      } catch (error) {
        this.totalConnections--;
        // 继续等待
      }
    }

    // 3. 等待可用连接
    return this._waitForConnection();
  }

  async query(sql, params) {
    const conn = await this.getConnection();
    try {
      const result = await this._execute(conn, sql, params);
      return result;
    } finally {
      this.release(conn);
    }
  }

  async transaction(fn) {
    const conn = await this.getConnection();
    try {
      await this._execute(conn, 'START TRANSACTION');
      const result = await fn({
        query: (sql, params) => this._execute(conn, sql, params),
        execute: (sql, params) => this._execute(conn, sql, params),
      });
      await this._execute(conn, 'COMMIT');
      return result;
    } catch (error) {
      await this._execute(conn, 'ROLLBACK').catch(() => {});
      throw error;
    } finally {
      this.release(conn);
    }
  }

  release(conn) {
    const state = this.activeConnections.get(conn);
    if (!state) return; // 已经被释放或不是活跃连接

    // 取消泄漏检测
    if (state.leakTimer) {
      clearTimeout(state.leakTimer);
    }

    this.activeConnections.delete(conn);

    if (this.closed || !this._isValid(conn)) {
      this._destroyConnection(conn);
      this._ensureMinIdle();
      return;
    }

    // 检查生命周期
    if (Date.now() - conn.__createdAt > this.maxLifetime) {
      this._destroyConnection(conn);
      this._ensureMinIdle();
      return;
    }

    // 更新最后访问时间
    conn.__lastAccessAt = Date.now();

    // 优先满足等待队列
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      waiter.resolve(this._checkout(conn));
      return;
    }

    // 归还到空闲队列
    this.idleConnections.push(conn);
  }

  // ========== 内部方法 ==========

  async _createConnection() {
    let conn;
    if (this.connectionFactory) {
      conn = await this.connectionFactory(this.config);
    } else {
      // 默认使用 mysql2
      const mysql = require('mysql2/promise');
      conn = await mysql.createConnection(this.config);
    }

    conn.__createdAt = Date.now();
    conn.__lastAccessAt = Date.now();
    conn.__id = Math.random().toString(36).slice(2, 10);
    
    return conn;
  }

  _getIdleConnection() {
    while (this.idleConnections.length > 0) {
      const conn = this.idleConnections.shift();
      if (this._isValid(conn)) {
        return conn;
      }
      this._destroyConnection(conn);
    }
    return null;
  }

  _checkout(conn) {
    const state = {
      borrowTime: Date.now(),
      leakTimer: null,
    };

    if (this.leakDetectionThreshold > 0) {
      state.leakTimer = setTimeout(() => {
        console.error(
          `[ConnectionPool] Leak detected: conn=${conn.__id}, ` +
          `borrowed=${Date.now() - state.borrowTime}ms ago`
        );
        this.emit('leak', { conn, borrowedAt: state.borrowTime });
      }, this.leakDetectionThreshold);
    }

    this.activeConnections.set(conn, state);
    return conn;
  }

  _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waitQueue.findIndex((w) => w.timer === timer);
        if (idx !== -1) this.waitQueue.splice(idx, 1);
        reject(new Error(
          `Timeout waiting for connection (${this.maxWaitMs}ms). ` +
          `active=${this.activeConnections.size}, idle=${this.idleConnections.length}, total=${this.totalConnections}`
        ));
      }, this.maxWaitMs);

      this.waitQueue.push({ resolve, reject, timer });
    });
  }

  async _execute(conn, sql, params = []) {
    // 通用执行接口，适配不同驱动
    if (conn.execute) {
      const [rows] = await conn.execute(sql, params);
      return rows;
    }
    if (conn.query) {
      return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
    }
    throw new Error('Unsupported connection type');
  }

  _isValid(conn) {
    // 简化版：检查连接是否已关闭
    if (conn._closing || conn._closed) return false;
    return true;
  }

  _destroyConnection(conn) {
    this.totalConnections--;
    if (conn.end) {
      conn.end().catch(() => {});
    } else if (conn.destroy) {
      conn.destroy();
    }
  }

  // ========== House Keeper ==========

  _startHouseKeeper() {
    this.houseKeeperInterval = setInterval(() => {
      this._houseKeep();
    }, 30000);
  }

  _houseKeep() {
    const now = Date.now();

    // 清理超时空闲连接
    const toRemove = [];
    const minKeep = Math.min(this.idleConnections.length, this.minIdle);
    
    for (let i = this.idleConnections.length - 1; i >= minKeep; i--) {
      const conn = this.idleConnections[i];
      if (now - conn.__lastAccessAt > this.idleTimeout) {
        toRemove.push(i);
      }
    }

    for (const idx of toRemove) {
      const conn = this.idleConnections.splice(idx, 1)[0];
      this._destroyConnection(conn);
    }

    // 确保最小连接数
    this._ensureMinIdle();
  }

  async _ensureMinIdle() {
    const needed = this.minIdle - this.idleConnections.length - this.activeConnections.size;
    if (needed <= 0) return;
    if (this.totalConnections >= this.maxActive) return;

    for (let i = 0; i < needed && this.totalConnections < this.maxActive; i++) {
      this.totalConnections++;
      try {
        const conn = await this._createConnection();
        this.idleConnections.push(conn);
      } catch {
        this.totalConnections--;
      }
    }
  }

  // ========== 统计 ==========

  stats() {
    return {
      total: this.totalConnections,
      active: this.activeConnections.size,
      idle: this.idleConnections.length,
      waiting: this.waitQueue.length,
      max: this.maxActive,
    };
  }

  async close() {
    this.closed = true;
    clearInterval(this.houseKeeperInterval);

    // 拒绝等待中的请求
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Pool is closing'));
    }
    this.waitQueue = [];

    // 关闭活跃连接
    for (const [conn] of this.activeConnections) {
      this._destroyConnection(conn);
    }
    this.activeConnections.clear();

    // 关闭空闲连接
    for (const conn of this.idleConnections) {
      this._destroyConnection(conn);
    }
    this.idleConnections = [];
  }
}

// ========== 使用 ==========

const pool = new ConnectionPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  minIdle: 2,
  maxActive: 10,
  leakDetectionThreshold: 30000,
});

pool.on('leak', ({ conn, borrowedAt }) => {
  console.error(`Connection leak: ${conn.__id}, borrowed at ${new Date(borrowedAt)}`);
});

// 简单查询
const users = await pool.query('SELECT * FROM users WHERE status = ?', ['active']);

// 事务
await pool.transaction(async (tx) => {
  await tx.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1]);
  await tx.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2]);
});

console.log(pool.stats());
await pool.close();

module.exports = { ConnectionPool };
```
