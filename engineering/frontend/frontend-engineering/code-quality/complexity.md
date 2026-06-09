# 复杂度控制

## 1. 圈复杂度（Cyclomatic Complexity）

```javascript
// ❌ 圈复杂度过高（多个条件分支）
function processOrder(order) {
  if (!order) return null;
  if (order.status === 'pending') {
    if (order.payment === 'credit') {
      if (order.amount > 1000) {
        // ...
      } else {
        // ...
      }
    } else if (order.payment === 'debit') {
      // ...
    }
  } else if (order.status === 'completed') {
    // ...
  }
  // ... 更多分支
}

// ✅ 降低复杂度：策略模式
const processors = {
  pending: {
    credit: (order) => order.amount > 1000 ? processLargeCredit(order) : processSmallCredit(order),
    debit: processDebit,
  },
  completed: processCompleted,
};

function processOrder(order) {
  if (!order) return null;
  return processors[order.status]?.[order.payment]?.(order);
}
```

## 2. 认知复杂度

```javascript
// ❌ 嵌套过深，难以理解
function validate(data) {
  if (data) {
    if (data.user) {
      if (data.user.email) {
        if (data.user.email.includes('@')) {
          return true;
        }
      }
    }
  }
  return false;
}

// ✅ 提前返回（guard clauses）
function validate(data) {
  if (!data) return false;
  if (!data.user) return false;
  if (!data.user.email) return false;
  return data.user.email.includes('@');
}
```

## 3. 工具

```bash
# 检查复杂度
npx complexity-report src/
npx eslint --rule 'complexity: [error, 10]' src/

# SonarQube 阈值
# 圈复杂度 > 10: warning
# 圈复杂度 > 20: error
# 认知复杂度 > 15: warning
```
