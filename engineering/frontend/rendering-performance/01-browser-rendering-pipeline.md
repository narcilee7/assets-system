# 浏览器渲染管线

## 1. 关键渲染路径

```
HTML                    CSS
  │                      │
  ▼                      ▼
DOM Tree              CSSOM Tree
  │                      │
  └──────────┬───────────┘
             ▼
       Render Tree（可见节点）
             │
             ▼
       Layout（Reflow）
       计算几何信息（位置/大小）
             │
             ▼
       Paint（绘制）
       生成绘制指令
             │
             ▼
       Composite（合成）
       分层 → GPU 合成 → 显示
```

## 2. Reflow vs Repaint vs Composite

| 操作 | 触发条件 | 成本 | 示例 |
|------|----------|------|------|
| **Reflow** | 几何属性变化 | 最高 | width、height、top、left、margin |
| **Repaint** | 视觉属性变化 | 中 | color、background、visibility |
| **Composite** | 仅合成层属性 | 最低 | transform、opacity |

```javascript
// ❌ 触发 Reflow（最昂贵）
element.style.width = '100px';
element.style.height = '100px';
element.style.margin = '10px';
// 三次修改触发三次 Reflow

// ✅ 批量修改（只触发一次 Reflow）
element.style.cssText = 'width:100px;height:100px;margin:10px;';

// ✅ 或使用 CSS 类
element.classList.add('expanded');

// ✅ 使用 transform（仅触发 Composite）
element.style.transform = 'translateX(100px) scale(1.2)';
```

## 3. 强制同步布局（Forced Synchronous Layout）

```javascript
// ❌ 读取属性后立刻修改（强制同步布局）
function bad() {
  for (let i = 0; i < 100; i++) {
    const height = element.offsetHeight;  // 读取（触发 Reflow）
    element.style.height = height + 1 + 'px';  // 修改（再次 Reflow）
  }
  // 200 次 Reflow！
}

// ✅ 批量读取，批量写入
function good() {
  const heights = [];
  for (let i = 0; i < 100; i++) {
    heights.push(elements[i].offsetHeight);  // 批量读取
  }
  for (let i = 0; i < 100; i++) {
    elements[i].style.height = heights[i] + 1 + 'px';  // 批量写入
  }
  // 2 次 Reflow
}

// ✅ 使用 requestAnimationFrame
function better() {
  requestAnimationFrame(() => {
    // 在下一帧开始时批量处理
  });
}
```

## 4. 合成层（Compositor Layer）

```css
/* 提升为独立合成层（GPU 加速） */
.animated-element {
  will-change: transform;  /* 提示浏览器创建合成层 */
  transform: translateZ(0);  /* 强制创建合成层 */
}

/* ⚠️ 不要滥用：每个合成层都消耗 GPU 内存 */
```

```javascript
// DevTools 查看合成层
// Layers 面板 → 查看哪些元素在独立层
// Rendering → Layer borders（显示层边界）
```

## 5. 渲染优化原则

```
1. 减少 Reflow：批量读写、使用 class、避免在循环中读取布局属性
2. 使用 transform/opacity：它们只触发 Composite
3. 减少 DOM 深度：浅层 DOM 更快
4. 避免大面积 Repaint：使用 contain 隔离
5. 谨慎使用 will-change：提前创建合成层，但消耗内存
6. 使用 requestAnimationFrame：将 DOM 操作对齐到渲染帧
```
