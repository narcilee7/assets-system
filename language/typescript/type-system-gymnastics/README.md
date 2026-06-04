# Type System Gymnastics

这一层训练 TypeScript 类型层面的建模能力：条件类型、映射类型、infer、递归类型、模板字面量类型。

## 必会概念

- 条件类型的分配律：`T extends U ? X : Y` 在 `T` 是联合类型时会分配。
- infer 的提取能力：从函数签名、Promise、数组等结构中提取类型参数。
- 逆变位置与协变位置：函数参数是逆变的，返回值是协变的。
- 递归类型的终止：必须有一个基础情况，否则触发 TS 深度限制。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 递归只读 | `deep-readonly/` | ready | 递归 mapped type、数组/对象/函数分类 |
| 按值类型筛选 key | `pick-by-value/` | ready | key remapping、条件类型 |
| 联合转交叉 | `union-to-intersection/` | ready | 逆变位置、infer 提取 |
| 字符串操作类型 | `string-manipulation/` | todo | 模板字面量类型、StringToUnion、KebabCase |
| 元组操作类型 | `tuple-manipulation/` | todo | TupleToObject、Reverse、Zip |
| 函数柯里化类型 | `curry-and-pipe/` | todo | 变长参数、递归类型、函数组合 |
