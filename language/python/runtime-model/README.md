# Runtime Model

这一层训练 Python 运行时直觉：对象模型、名字绑定、引用、拷贝、可变/不可变。

## 必会概念

- Python 中一切皆为对象，变量是对象的名称（引用）。
- 可变对象（list、dict、set）与不可变对象（int、str、tuple）的行为差异。
- 深拷贝 vs 浅拷贝：`copy.copy` vs `copy.deepcopy`。
- 名字绑定：赋值不复制数据，只是绑定名称到对象。
- `is` 比较身份（id），`==` 比较值。

## 已有资产

| 资产 | 目录 | 状态 | 目标 |
|------|------|------|------|
| 对象模型与深拷贝 | `object_model/` | done | deep_copy、flatten、dp_cv |

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 深拷贝实现 | `object_model/deep_copy.py` | done | 循环引用、自定义对象 |
| 扁平化嵌套结构 | `object_model/flatten.py` | todo | 递归、迭代器 |
| 去重与分组 | `object_model/dedup.py` | todo | hashable、key 函数 |
| 分块处理 | `object_model/chunk.py` | todo | 生成器、内存效率 |
