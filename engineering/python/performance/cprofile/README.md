# Python cProfile

cProfile 是 Python 标准库的性能分析器，低开销，适合生产环境分析。

## 基础使用

```python
# profile_script.py
import cProfile
import pstats
from io import StringIO

def slow_function():
    result = []
    for i in range(10000):
        result.append(sum(range(i)))
    return result

# 方法1: 命令行
# python -m cProfile -s cumulative myscript.py

# 方法2: 代码内分析
profiler = cProfile.Profile()
profiler.enable()
slow_function()
profiler.disable()

# 输出统计
s = StringIO()
ps = pstats.Stats(profiler, stream=s).sort_stats("cumulative")
ps.print_stats(20)
print(s.getvalue())

# 保存到文件
profiler.dump_stats("profile.stats")

# 可视化（snakeviz）
# pip install snakeviz
# snakeviz profile.stats
```

## 装饰器

```python
import functools
import cProfile

def profile(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        profiler = cProfile.Profile()
        profiler.enable()
        result = func(*args, **kwargs)
        profiler.disable()
        profiler.print_stats(sort="cumulative")
        return result
    return wrapper

@profile
def heavy_computation():
    return sum(i ** 2 for i in range(10**6))
```

## 关键指标

| 列 | 含义 |
| --- | --- |
| ncalls | 调用次数 |
| tottime | 函数自身执行时间（不含子调用） |
| percall | tottime / ncalls |
| cumtime | 累计时间（含子调用） |
| percall | cumtime / ncalls |
| filename | 文件名和行号 |
