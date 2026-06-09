# Python Package Management

Python 的包管理经历了 pip → virtualenv → pipenv → poetry → uv 的演进。

## Poetry（现代推荐）

```bash
# 安装
pip install poetry

# 初始化项目
poetry new myproject
cd myproject

# 添加依赖
poetry add fastapi pydantic

# 添加开发依赖
poetry add --group dev pytest black ruff

# 安装所有依赖
poetry install

# 激活环境
poetry shell

# 运行
poetry run python main.py

# 构建和发布
poetry build
poetry publish
```

## pyproject.toml

```toml
[tool.poetry]
name = "myproject"
version = "0.1.0"
description = "My Python project"
authors = ["Your Name <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.104.0"
pydantic = "^2.5.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
black = "^23.0.0"
ruff = "^0.1.0"

[tool.black]
line-length = 100

[tool.ruff]
line-length = 100
select = ["E", "F", "I"]
```

## uv（新一代极速包管理器）

```bash
# 安装
pip install uv

# 创建虚拟环境
uv venv

# 安装依赖（比 pip 快 10-100 倍）
uv pip install fastapi

# 从 requirements.txt
uv pip install -r requirements.txt

# 导出锁定文件
uv pip compile requirements.in -o requirements.txt
```

## Python vs Node.js

| 维度 | Python | Node.js |
| --- | --- | --- |
| 包管理 | Poetry/uv | npm/pnpm |
| 虚拟环境 | 必须 | node_modules |
| 锁文件 | poetry.lock | package-lock.json |
| 开发依赖 | 分组支持 | devDependencies |
| 版本解析 | 依赖约束复杂 | npm semver |
