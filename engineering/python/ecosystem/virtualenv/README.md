# Python Virtualenv

虚拟环境是 Python 项目隔离依赖的标准方案。

## venv（内置）

```bash
# 创建
python -m venv .venv

# 激活
source .venv/bin/activate      # Linux/macOS
.venv\Scripts\activate         # Windows

# 退出
deactivate
```

## virtualenv

```bash
pip install virtualenv

# 创建
virtualenv .venv --python=python3.11

# 使用
source .venv/bin/activate
```

## direnv（自动激活）

```bash
# .envrc
layout_python
# 或
layout_poetry
```

```bash
echo "source .venv/bin/activate" > .envrc
direnv allow
```

进入目录时自动激活虚拟环境，离开时自动退出。

## 最佳实践

- `.venv/` 加入 `.gitignore`
- 使用 `direnv` 管理环境变量
- 明确记录 Python 版本（`.python-version`）
- CI/CD 中使用 `pip install -r requirements.txt` 或 `poetry install`
