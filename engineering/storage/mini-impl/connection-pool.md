# 手写数据库连接池

## 目标

实现一个简化版数据库连接池，支持：
1. 连接复用
2. 最大/最小连接数控制
3. 连接超时获取
4. 空闲连接检测
5. 连接泄漏检测
6. 连接健康检查

## 实现

```java
// ConnectionPool.java

import java.sql.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

public class ConnectionPool {
    private final String jdbcUrl;
    private final String username;
    private final String password;
    
    private final int minIdle;
    private final int maxActive;
    private final long maxWaitMillis;
    private final long maxLifetime;
    private final long idleTimeout;
    private final long leakDetectionThreshold;
    private final String validationQuery;
    
    private final BlockingQueue<PooledConnection> idleConnections;
    private final ConcurrentMap<PooledConnection, ConnectionState> activeConnections;
    private final AtomicInteger totalConnections = new AtomicInteger(0);
    private final AtomicBoolean closed = new AtomicBoolean(false);
    
    private final ScheduledExecutorService houseKeeper;
    private final ThreadFactory threadFactory;

    public ConnectionPool(PoolConfig config) {
        this.jdbcUrl = config.jdbcUrl;
        this.username = config.username;
        this.password = config.password;
        this.minIdle = config.minIdle;
        this.maxActive = config.maxActive;
        this.maxWaitMillis = config.maxWaitMillis;
        this.maxLifetime = config.maxLifetime;
        this.idleTimeout = config.idleTimeout;
        this.leakDetectionThreshold = config.leakDetectionThreshold;
        this.validationQuery = config.validationQuery;
        
        this.idleConnections = new LinkedBlockingQueue<>(maxActive);
        this.activeConnections = new ConcurrentHashMap<>();
        this.threadFactory = new PoolThreadFactory(config.poolName);
        this.houseKeeper = Executors.newSingleThreadScheduledExecutor(threadFactory);
        
        // 初始化最小连接数
        for (int i = 0; i < minIdle; i++) {
            try {
                PooledConnection conn = createConnection();
                idleConnections.offer(conn);
            } catch (SQLException e) {
                throw new RuntimeException("Failed to initialize pool", e);
            }
        }
        
        // 启动 housekeeping 线程
        this.houseKeeper.scheduleWithFixedDelay(
            this::houseKeep, 30, 30, TimeUnit.SECONDS
        );
    }

    // ========== 核心 API ==========

    public Connection getConnection() throws SQLException {
        if (closed.get()) {
            throw new SQLException("Pool is closed");
        }
        
        PooledConnection connection = idleConnections.poll();
        
        // 尝试创建新连接
        if (connection == null && totalConnections.get() < maxActive) {
            if (totalConnections.incrementAndGet() <= maxActive) {
                try {
                    connection = createConnection();
                } catch (SQLException e) {
                    totalConnections.decrementAndGet();
                    throw e;
                }
            } else {
                totalConnections.decrementAndGet();
            }
        }
        
        // 等待可用连接
        if (connection == null) {
            try {
                connection = idleConnections.poll(maxWaitMillis, TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new SQLException("Interrupted while waiting for connection");
            }
        }
        
        if (connection == null) {
            throw new SQLException(
                String.format("Timeout waiting for connection (%dms). Pool: active=%d, idle=%d, total=%d",
                    maxWaitMillis, activeConnections.size(), idleConnections.size(), totalConnections.get())
            );
        }
        
        // 验证连接有效性
        if (!isValid(connection)) {
            totalConnections.decrementAndGet();
            return getConnection(); // 递归获取下一个
        }
        
        // 标记为活跃
        ConnectionState state = new ConnectionState();
        state.borrowTime = System.currentTimeMillis();
        activeConnections.put(connection, state);
        
        // 泄漏检测
        if (leakDetectionThreshold > 0) {
            state.leakTask = houseKeeper.schedule(() -> {
                if (activeConnections.containsKey(connection)) {
                    System.err.println("Connection leak detected: " + connection +
                        ", borrowed at " + new java.util.Date(state.borrowTime));
                }
            }, leakDetectionThreshold, TimeUnit.MILLISECONDS);
        }
        
        return new ProxyConnection(connection, this);
    }

    void returnConnection(PooledConnection connection) {
        ConnectionState state = activeConnections.remove(connection);
        if (state != null && state.leakTask != null) {
            state.leakTask.cancel(false);
        }
        
        if (closed.get() || !isValid(connection)) {
            closeConnection(connection);
            return;
        }
        
        // 检查生命周期
        if (System.currentTimeMillis() - connection.creationTime > maxLifetime) {
            closeConnection(connection);
            // 维持最小连接数
            ensureMinIdle();
            return;
        }
        
        idleConnections.offer(connection);
    }

    // ========== 连接管理 ==========

    private PooledConnection createConnection() throws SQLException {
        Connection raw = DriverManager.getConnection(jdbcUrl, username, password);
        PooledConnection pooled = new PooledConnection(raw);
        pooled.creationTime = System.currentTimeMillis();
        return pooled;
    }

    private void closeConnection(PooledConnection connection) {
        try {
            connection.raw.close();
        } catch (SQLException e) {
            // ignore
        }
        totalConnections.decrementAndGet();
    }

    private boolean isValid(PooledConnection connection) {
        try {
            if (validationQuery != null) {
                try (Statement stmt = connection.raw.createStatement()) {
                    stmt.execute(validationQuery);
                }
            } else {
                return connection.raw.isValid(3);
            }
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    // ========== House Keeping ==========

    private void houseKeep() {
        if (closed.get()) return;
        
        // 清理超时空闲连接
        long now = System.currentTimeMillis();
        for (PooledConnection conn : idleConnections) {
            if (idleConnections.size() <= minIdle) break;
            
            if (now - conn.lastAccessTime > idleTimeout) {
                if (idleConnections.remove(conn)) {
                    closeConnection(conn);
                }
            }
        }
        
        // 确保最小连接数
        ensureMinIdle();
    }

    private void ensureMinIdle() {
        while (idleConnections.size() + activeConnections.size() < minIdle 
               && totalConnections.get() < maxActive) {
            if (totalConnections.incrementAndGet() <= maxActive) {
                try {
                    PooledConnection conn = createConnection();
                    idleConnections.offer(conn);
                } catch (SQLException e) {
                    totalConnections.decrementAndGet();
                    break;
                }
            } else {
                totalConnections.decrementAndGet();
                break;
            }
        }
    }

    // ========== 关闭 ==========

    public void close() {
        if (!closed.compareAndSet(false, true)) return;
        
        houseKeeper.shutdown();
        
        for (PooledConnection conn : activeConnections.keySet()) {
            closeConnection(conn);
        }
        activeConnections.clear();
        
        for (PooledConnection conn : idleConnections) {
            closeConnection(conn);
        }
        idleConnections.clear();
    }

    public PoolStats getStats() {
        return new PoolStats(
            totalConnections.get(),
            activeConnections.size(),
            idleConnections.size(),
            maxActive
        );
    }

    // ========== 内部类 ==========

    static class PooledConnection {
        final Connection raw;
        long creationTime;
        long lastAccessTime;
        
        PooledConnection(Connection raw) {
            this.raw = raw;
            this.lastAccessTime = System.currentTimeMillis();
        }
    }

    static class ConnectionState {
        long borrowTime;
        ScheduledFuture<?> leakTask;
    }

    public static class PoolConfig {
        String poolName = "default";
        String jdbcUrl;
        String username;
        String password;
        int minIdle = 5;
        int maxActive = 20;
        long maxWaitMillis = 30000;
        long maxLifetime = 1800000;
        long idleTimeout = 600000;
        long leakDetectionThreshold = 0;
        String validationQuery = "SELECT 1";
    }

    public static class PoolStats {
        public final int total;
        public final int active;
        public final int idle;
        public final int max;
        
        PoolStats(int total, int active, int idle, int max) {
            this.total = total;
            this.active = active;
            this.idle = idle;
            this.max = max;
        }
        
        @Override
        public String toString() {
            return String.format("PoolStats{total=%d, active=%d, idle=%d, max=%d}",
                total, active, idle, max);
        }
    }

    static class PoolThreadFactory implements ThreadFactory {
        private final String prefix;
        private final AtomicInteger counter = new AtomicInteger(0);
        
        PoolThreadFactory(String prefix) {
            this.prefix = prefix;
        }
        
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, prefix + "-housekeeper-" + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
        }
    }
}

// ========== 代理连接（拦截 close）==========

class ProxyConnection implements Connection {
    private final ConnectionPool.PooledConnection delegate;
    private final ConnectionPool pool;
    private final Connection raw;
    private final AtomicBoolean closed = new AtomicBoolean(false);
    
    ProxyConnection(ConnectionPool.PooledConnection delegate, ConnectionPool pool) {
        this.delegate = delegate;
        this.pool = pool;
        this.raw = delegate.raw;
    }
    
    @Override
    public void close() throws SQLException {
        if (closed.compareAndSet(false, true)) {
            pool.returnConnection(delegate);
        }
    }
    
    // 委托所有方法到 raw...
    @Override
    public Statement createStatement() throws SQLException { return raw.createStatement(); }
    @Override
    public PreparedStatement prepareStatement(String sql) throws SQLException { return raw.prepareStatement(sql); }
    // ... 其他 Connection 方法
}

// ========== 使用 ==========

public class Main {
    public static void main(String[] args) throws Exception {
        ConnectionPool.PoolConfig config = new ConnectionPool.PoolConfig();
        config.jdbcUrl = "jdbc:mysql://localhost:3306/mydb";
        config.username = "user";
        config.password = "pass";
        config.minIdle = 5;
        config.maxActive = 20;
        config.leakDetectionThreshold = 30000;
        
        ConnectionPool pool = new ConnectionPool(config);
        
        try (Connection conn = pool.getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement("SELECT 1")) {
                ResultSet rs = ps.executeQuery();
                while (rs.next()) {
                    System.out.println(rs.getInt(1));
                }
            }
        } // close() 被拦截，连接归还到池中
        
        System.out.println(pool.getStats());
        pool.close();
    }
}
```
