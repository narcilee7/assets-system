# 描述符与 OOP 层

这一层训练 Python 高阶对象模型。ORM、Pydantic、FastAPI 参数系统、`property`、`cached_property` 背后都有描述符的影子。

## 必会概念

- `__get__`、`__set__`、`__delete__` 构成描述符协议。
- 数据描述符优先级高于实例属性。
- 非数据描述符会被实例属性覆盖。
- `__set_name__` 能在类创建时拿到字段名。
- `__getattr__` 只在普通查找失败后触发，`__getattribute__` 会拦截所有属性访问。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| 手写 `property` | `my_property.py` | todo | 描述符协议 |
| 手写 `cached_property` | `cached_property.py` | todo | 首次计算、实例字典缓存 |
| 手写字段校验描述符 | `typed_field.py` | todo | `__set_name__`、类型检查 |
| 手写简单 ORM Field | `orm_field.py` | todo | 字段元数据、类收集 |
| 手写简化版 `dataclass` | `mini_dataclass.py` | todo | 类装饰器、字段发现 |
