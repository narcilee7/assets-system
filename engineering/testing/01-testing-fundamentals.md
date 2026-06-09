# 测试基础

## 1. 测试金字塔

```
测试金字塔（Test Pyramid）

          ▲
         /│\
        / │ \        E2E 测试（10%）
       /  │  \       - 慢（分钟级）
      /   │   \      - 贵（需要完整环境）
     /────┼────\     - 覆盖用户场景
    /     │     \
   /      │      \   集成测试（20%）
  /       │       \  - 中等速度（秒级）
 /        │        \ - 测试组件协作
/─────────┼─────────\─────────────────
          │          单元测试（70%）
          │          - 快（毫秒级）
          │          - 便宜（无外部依赖）
          │          - 覆盖业务逻辑

反模式：冰淇淋筒（测试甜筒）
          │
       ───────        E2E 过多
      │       │       - 维护成本高
      │       │       - 反馈慢
      │       │       - 环境不稳定
       ───────
          │
         ───          集成测试不足
        │   │
         ───
          │
          ▼           单元测试极少
```

| 层级 | 数量 | 速度 | 成本 | 定位问题 | 维护成本 |
|------|------|------|------|----------|----------|
| 单元测试 | 多 | < 10ms | 低 | 精确到行 | 低 |
| 集成测试 | 中 | 秒级 | 中 | 精确到组件 | 中 |
| E2E 测试 | 少 | 分钟级 | 高 | 模糊 | 高 |

## 2. 测试驱动开发（TDD）

```
TDD 循环（Red-Green-Refactor）

  ┌─────────────────┐
  │  1. Red（红）    │  写一个失败的测试
  │  写测试          │  确认测试能捕获错误
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  2. Green（绿）  │  写最少代码让测试通过
  │  写实现          │  可以 hardcode，可以丑陋
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │ 3. Refactor（重构）│  清理代码，保持测试通过
  │  优化代码        │  消除重复，改善命名
  └─────────────────┘
           │
           └──────▶ 回到 1，写下一个测试

TDD 的好处：
├── 设计反馈：难写的测试 = 设计有问题
├── 安全网：重构时有信心
├── 文档：测试用例就是使用示例
├── 聚焦：一次只做一件事
└── 调试少：问题在刚引入时就被发现

TDD 不适用场景：
├── 探索性编程（需求不明确）
├── UI 细节（变化频繁）
├── 一次性脚本
└── 依赖外部系统的集成测试
```

```python
# TDD 示例：实现一个购物车

# Step 1: Red - 写失败的测试
def test_add_item_to_cart():
    cart = ShoppingCart()
    cart.add("apple", price=1.0, quantity=2)
    assert cart.total() == 2.0

# Step 2: Green - 最少代码让测试通过
class ShoppingCart:
    def __init__(self):
        self.items = []

    def add(self, name, price, quantity):
        self.items.append((name, price, quantity))

    def total(self):
        return sum(price * qty for _, price, qty in self.items)

# Step 3: Refactor - 清理（当前已经够简洁）

# 下一个测试：
def test_remove_item_from_cart():
    cart = ShoppingCart()
    cart.add("apple", price=1.0, quantity=2)
    cart.remove("apple")
    assert cart.total() == 0.0
```

## 3. BDD（行为驱动开发）

```
BDD：从业务角度描述行为

Given-When-Then 格式：

Feature: 用户登录
  Scenario: 使用有效凭据登录
    Given 用户已注册账号 "alice" 密码 "secret"
    When 用户使用 "alice" 和 "secret" 登录
    Then 登录成功
    And 生成访问令牌

  Scenario: 使用无效密码登录
    Given 用户已注册账号 "alice" 密码 "secret"
    When 用户使用 "alice" 和 "wrong" 登录
    Then 登录失败
    And 显示错误信息 "密码错误"

工具：Cucumber（多语言）、Jest-Cucumber、Behave（Python）
适用：业务规则复杂的领域、跨团队协作
```

## 4. 测试分类

```
测试分类维度

按范围：
├── 单元测试：单个函数/类，隔离依赖
├── 集成测试：多个组件协作
├── 系统测试：完整系统
└── E2E 测试：用户视角

按目的：
├── 功能测试：验证行为正确
├── 性能测试：验证性能指标
├── 安全测试：发现安全漏洞
├── 兼容性测试：不同环境
└── 回归测试：防止旧 bug 复发

按时机：
├── 静态测试：代码审查、lint、类型检查
├── 提交前测试：pre-commit hook
├── CI 测试：每次提交
├── 预发布测试：staging 环境
├── 生产测试：canary、监控
└── 回归测试：定期全量

按属性：
├── 确定性测试：给定输入总是相同输出
├── 非确定性测试：涉及随机、时间、并发
├── 有状态测试：依赖之前的状态
└── 无状态测试：每个测试独立
```

## 5. FIRST 原则

```
好的单元测试应满足 FIRST：

F - Fast（快速）
├── 单元测试应该在毫秒级完成
├── 慢测试不会被频繁运行
├── 避免：真实数据库、网络请求、文件 I/O
└── 解决：Mock、内存数据库、临时文件

I - Independent（独立）
├── 测试之间不应有依赖
├── 执行顺序不应影响结果
├── 每个测试独立设置和清理
└── 反模式：共享可变状态

R - Repeatable（可重复）
├── 在任何环境都能得到相同结果
├── 不依赖外部状态
├── 不依赖当前时间（除非 Mock）
└── 不依赖随机数（除非固定种子）

S - Self-validating（自验证）
├── 测试结果应该是 pass/fail
├── 不应需要人工检查日志
├── 断言应该明确且具体
└── 反模式：打印结果让人看

T - Timely（及时）
├── 测试应该与代码一起编写
├──  ideally：TDD，先写测试
├──  at least：同一 PR 中
└── 最差：事后补测试（往往不会补）
```

```python
# FIRST 原则示例

# Fast：使用内存数据库
import pytest

@pytest.fixture
def db():
    # SQLite in-memory，每个测试独立
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    yield conn
    conn.close()

def test_create_user_fast(db):
    db.execute("INSERT INTO users (name) VALUES (?)", ("Alice",))
    result = db.execute("SELECT * FROM users").fetchone()
    assert result[1] == "Alice"

# Independent：每个测试独立设置
def test_user_count_isolated(db):
    db.execute("INSERT INTO users (name) VALUES ('Bob')")
    count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    assert count == 1  # 不受其他测试影响

# Repeatable：Mock 时间
from unittest.mock import patch
from datetime import datetime

@patch('datetime.datetime')
def test_time_based_logic(mock_datetime):
    mock_datetime.now.return_value = datetime(2024, 6, 8, 12, 0, 0)
    result = is_business_hours()
    assert result is True  # 固定时间，结果确定

# Self-validating：明确断言
# 差：assert result is not None
# 好：
def test_calculate_discount():
    assert calculate_discount(100, "VIP") == 20  # 明确期望值
    assert calculate_discount(100, "NORMAL") == 5

# Timely：与功能代码一起提交
```
