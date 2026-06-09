# 单元测试

## 1. 测试框架选择

```
主流单元测试框架

JavaScript/TypeScript
├── Jest：零配置、Snapshot、Mock 内置、并行执行
├── Vitest：Vite 生态、ESM 优先、比 Jest 更快
├── Mocha + Chai：灵活、历史悠久
└── Node.js Test Runner（内置）：无依赖、原生支持

Python
├── pytest：功能丰富、插件生态、fixture 强大
├── unittest：标准库、xUnit 风格
└── Hypothesis：基于属性的测试

Go
├── testing：标准库、简洁
├── testify：断言、Mock、Suite
└── ginkgo/gomega：BDD 风格

Java
├── JUnit 5：标准、扩展性强
├── TestNG：更灵活的注解
└── Spock：Groovy、表现力强的 BDD

C++
├── Google Test（gtest）：最流行
├── Catch2：头文件-only、简洁
└── doctest：编译速度极快
```

```typescript
// Jest 示例
import { sum, fetchUser, UserService } from './user';

// 基础测试
describe('sum', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });

  test('adds negative numbers', () => {
    expect(sum(-1, -2)).toBe(-3);
  });
});

// 异步测试
describe('fetchUser', () => {
  test('fetches user by id', async () => {
    const user = await fetchUser(1);
    expect(user).toEqual({ id: 1, name: 'Alice' });
  });

  test('throws on not found', async () => {
    await expect(fetchUser(999)).rejects.toThrow('Not found');
  });
});

// Setup / Teardown
let service: UserService;

beforeEach(() => {
  service = new UserService();
});

afterEach(() => {
  service.cleanup();
});
```

## 2. Mock 与 Stub

```
测试替身类型

Dummy（哑对象）
├── 仅填充参数位置
├── 不会被真正使用
└── 示例：new Logger() 传入但测试不验证日志

Fake（假对象）
├── 有实际工作实现，但简化版
├── 示例：内存数据库替代真实数据库
└── 示例：InMemoryCache 替代 Redis

Stub（桩）
├── 预设返回值
├── 无逻辑，仅响应调用
└── 示例：stubUserRepo.findById(1).returns({id: 1})

Spy（间谍）
├── 记录调用信息
├── 可验证调用次数、参数
└── 示例：spyOn(console, 'log')

Mock（模拟）
├── 预设期望 + 验证
├── 最严格：先设期望，后验证
└── 示例：mockHttp.expect('GET', '/api/users').andRespond(200, [])

Fake vs Mock 选择
├── Fake：行为接近真实，测试更可信
├── Mock：测试更精确，但耦合更强
└── 推荐：优先 Fake，必要时 Mock
```

```typescript
// Jest Mock 示例
import { jest } from '@jest/globals';

// 模块 Mock
jest.mock('./api', () => ({
  fetchUser: jest.fn(),
}));

import { fetchUser } from './api';

// Stub
test('uses stubbed user', async () => {
  (fetchUser as jest.Mock).mockResolvedValue({ id: 1, name: 'Alice' });

  const service = new UserService();
  const user = await service.getUser(1);

  expect(user.name).toBe('Alice');
});

// Spy
test('logs errors', () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

  processError(new Error('test'));

  expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.any(Error));
  consoleSpy.mockRestore();
});

// Mock 验证
test('saves user to repo', async () => {
  const mockRepo = {
    save: jest.fn().mockResolvedValue({ id: 1 }),
  };

  const service = new UserService(mockRepo);
  await service.createUser('Alice');

  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Alice',
  }));
});
```

```python
# Python pytest + unittest.mock
from unittest.mock import Mock, patch, MagicMock
import pytest

# Patch 外部依赖
@patch('requests.get')
def test_fetch_user(mock_get):
    mock_get.return_value.json.return_value = {"id": 1, "name": "Alice"}
    mock_get.return_value.status_code = 200

    user = fetch_user(1)
    assert user["name"] == "Alice"
    mock_get.assert_called_once_with("https://api.example.com/users/1")

# Mock 对象
@pytest.fixture
def mock_repo():
    repo = Mock()
    repo.find_by_id.return_value = {"id": 1, "name": "Alice"}
    repo.save.return_value = {"id": 2}
    return repo

def test_create_user(mock_repo):
    service = UserService(mock_repo)
    user = service.create("Bob")

    mock_repo.save.assert_called_once()
    assert user["id"] == 2
```

## 3. 测试覆盖率

```
覆盖率指标

行覆盖率（Line Coverage）
├── 被测试执行到的代码行比例
├── 最容易提高但价值有限
└── 目标：> 80%

分支覆盖率（Branch Coverage）
├── if/else、switch 等各分支是否都被执行
├── 比行覆盖更有价值
└── 目标：> 80%

函数覆盖率（Function Coverage）
├── 被调用的函数比例
└── 基础指标

条件覆盖率（Condition Coverage）
├── 复杂条件中的每个子条件
└── 最难达到，价值最高

覆盖率陷阱
├── 高覆盖率 ≠ 高质量测试
├── 100% 覆盖率可能测试的是实现细节
├── 不要为了覆盖率而测试私有方法
└── 覆盖率是必要不充分条件
```

```bash
# Jest 覆盖率
npx jest --coverage

# pytest 覆盖率
pytest --cov=src --cov-report=html --cov-report=term-missing

# Go 覆盖率
go test -cover -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## 4. 参数化测试

```typescript
// Jest 参数化测试
describe('isValidEmail', () => {
  test.each([
    ['user@example.com', true],
    ['invalid', false],
    ['@example.com', false],
    ['user@', false],
    ['user+tag@example.com', true],
  ])('isValidEmail(%s) -> %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
```

```python
# pytest 参数化
import pytest

@pytest.mark.parametrize("input,expected", [
    ("user@example.com", True),
    ("invalid", False),
    ("@example.com", False),
    ("user@", False),
    ("user+tag@example.com", True),
])
def test_is_valid_email(input, expected):
    assert is_valid_email(input) == expected

# 多参数组合
@pytest.mark.parametrize("x", [1, 2])
@pytest.mark.parametrize("y", [10, 20])
def test_combinations(x, y):
    # 运行 4 次: (1,10), (1,20), (2,10), (2,20)
    assert x + y > 0
```
