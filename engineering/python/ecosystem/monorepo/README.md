# Python Monorepo

Python 单体仓库管理策略，使用 Poetry workspace 或 Pants 构建系统。

## Poetry Workspace

```toml
# pyproject.toml (根)
[tool.poetry]
name = "my-monorepo"
version = "0.1.0"
packages = [
    { include = "packages/*" }
]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.104.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
```

```toml
# packages/api/pyproject.toml
[tool.poetry]
name = "my-api"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.11"
my-shared = { path = "../shared", develop = true }
```

## Pants Build System

```python
# BUILD 文件
python_sources()

python_tests(
    name="tests",
    dependencies=["//packages/shared"],
)

pex_binary(
    name="api",
    entry_point="main.py",
)
```

```bash
# Pants 命令
pants test ::           # 运行所有测试
pants package ::        # 打包所有项目
pants run packages/api: # 运行 API
```
