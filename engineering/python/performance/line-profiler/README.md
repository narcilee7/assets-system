# Python Line Profiler

line_profiler 可以逐行分析函数执行时间，定位热点代码。

## 安装与使用

```bash
pip install line_profiler
```

```python
# profile_example.py
from line_profiler import profile

@profile
def process_data(data: list):
    result = []
    for item in data:
        cleaned = item.strip().lower()
        if len(cleaned) > 3:
            hashed = hash(cleaned)
            result.append(hashed)
    return result

# 运行
# kernprof -l -v profile_example.py
```

## 输出示例

```
Line #      Time  Per Hit   % Time  Line Contents
================================================
     4                             @profile
     5                             def process_data(data: list):
     6         2.0      2.0      0.1      result = []
     7       500.0      0.5     25.0      for item in data:
     8       800.0      0.8     40.0          cleaned = item.strip().lower()
     9       200.0      0.2     10.0          if len(cleaned) > 3:
    10       500.0      0.5     25.0              hashed = hash(cleaned)
    11        50.0      0.1      2.5              result.append(hashed)
    12         1.0      1.0      0.1      return result
```

## 内存分析（memory_profiler）

```python
from memory_profiler import profile

@profile
def memory_heavy():
    large_list = [0] * 10**7
    large_dict = {i: i for i in range(10**6)}
    del large_list
    return large_dict

# 运行
# python -m memory_profiler profile_example.py
```

## 与 cProfile 对比

| 工具 | 粒度 | 开销 | 适用场景 |
| --- | --- | --- | --- |
| cProfile | 函数级 | 低 | 整体性能分析 |
| line_profiler | 行级 | 高 | 定位热点代码 |
| memory_profiler | 行级 | 高 | 内存泄漏分析 |
