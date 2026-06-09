# pip / Poetry / uv 对比

Python 包管理器的演进路线：pip → pipenv → poetry → uv。

## pip

```bash
pip install -r requirements.txt
pip freeze > requirements.txt
```

- 优点：标准、简单
- 缺点：无锁文件、解析慢、无开发依赖分组

## Poetry

```bash
poetry add fastapi
poetry add --group dev pytest
poetry install
poetry run python main.py
```

- 优点：锁文件、开发依赖、构建发布一体
- 缺点：较慢、PEP 621 支持较晚

## uv

```bash
# 极速安装（比 pip 快 10-100 倍）
uv pip install fastapi

# 锁定依赖
uv pip compile requirements.in -o requirements.txt

# 项目管理
uv init
uv add fastapi
uv run python main.py
```

- 优点：Rust 实现、极速、兼容 pip
- 缺点：较新、生态正在完善

## 选型建议

| 场景 | 推荐工具 |
| --- | --- |
| 简单脚本 | pip |
| 中型项目 | Poetry |
| 大型项目/CI | uv |
| 快速原型 | uv |
| 需要发布到 PyPI | Poetry |
