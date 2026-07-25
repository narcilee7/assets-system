-- SQL 场景题：完整 Schema 汇总
-- 适用于 MySQL 8.0+

-- 场景一：电商订单
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  product_id BIGINT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL,
  INDEX idx_stock (stock)
);

CREATE TABLE orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_created (status, created_at)
);

CREATE TABLE order_items (
  item_id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  INDEX idx_order (order_id)
);

-- 场景二：社交网络
CREATE TABLE friendships (
  user_id BIGINT NOT NULL,
  friend_id BIGINT NOT NULL,
  status ENUM('pending', 'accepted') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  INDEX idx_friend (friend_id)
);

CREATE TABLE posts (
  post_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at)
);

CREATE TABLE likes (
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

-- 场景三：金融交易
CREATE TABLE transactions (
  txn_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18, 4) NOT NULL,
  txn_type ENUM('deposit', 'withdraw', 'transfer') NOT NULL,
  status ENUM('success', 'failed', 'pending') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_created (status, created_at)
);

-- 场景四：组织架构
CREATE TABLE employees (
  employee_id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  manager_id BIGINT,
  department VARCHAR(50),
  salary DECIMAL(12, 2),
  INDEX idx_manager (manager_id)
);

-- 场景五：库存仓库
CREATE TABLE warehouses (
  warehouse_id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE inventory (
  product_id BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, warehouse_id)
);

-- 场景六：日志埋点
CREATE TABLE events (
  event_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_name VARCHAR(50) NOT NULL,
  properties JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name_time (event_name, created_at),
  INDEX idx_user_time (user_id, created_at)
);

-- 场景七：A/B 实验
CREATE TABLE experiments (
  exp_id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP
);

CREATE TABLE experiment_users (
  exp_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  variant CHAR(1) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exp_id, user_id),
  INDEX idx_variant (exp_id, variant)
);

CREATE TABLE experiment_metrics (
  exp_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  metric_value DECIMAL(18, 4) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exp_id, user_id, metric_name),
  INDEX idx_metric (exp_id, metric_name)
);

-- 场景八：订阅账单
CREATE TABLE subscriptions (
  sub_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status ENUM('active', 'cancelled', 'expired') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  INDEX idx_user (user_id),
  INDEX idx_dates (start_date, end_date)
);

-- 场景九：网约车
CREATE TABLE drivers (
  driver_id BIGINT PRIMARY KEY,
  status ENUM('available', 'busy', 'offline') NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  INDEX idx_status (status),
  INDEX idx_location (lng, lat)
);

CREATE TABLE rides (
  ride_id BIGINT PRIMARY KEY,
  passenger_id BIGINT NOT NULL,
  driver_id BIGINT,
  status ENUM('requested', 'assigned', 'ongoing', 'completed', 'cancelled') NOT NULL,
  pickup_lng DECIMAL(10, 7) NOT NULL,
  pickup_lat DECIMAL(10, 7) NOT NULL,
  fare DECIMAL(10, 2),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_status_requested (status, requested_at),
  INDEX idx_driver (driver_id, requested_at)
);

-- 场景十：内容审核
CREATE TABLE content (
  content_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content_text TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_created (status, created_at)
);

CREATE TABLE content_reviews (
  review_id BIGINT PRIMARY KEY,
  content_id BIGINT NOT NULL,
  reviewer_id BIGINT NOT NULL,
  decision ENUM('approved', 'rejected') NOT NULL,
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content (content_id),
  INDEX idx_reviewer (reviewer_id, reviewed_at)
);

-- 索引设计工作坊示例
CREATE TABLE workshop_orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  country_code CHAR(2) NOT NULL,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_created_amount (status, created_at, total_amount),
  INDEX idx_country_status_created (country_code, status, created_at)
);
