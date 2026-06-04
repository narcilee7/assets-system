# Python 打包与工具链

这一层理解 Python 的打包系统、虚拟环境、以及现代工具链（ Poetry、Rye、uv）。

---

## 目录

| 文件 | 主题 |
|------|------|
| `packaging-history.md` | setuptools → flit → poetry → hatch → rye/uv |
| `pyproject-toml.md` | PEP 517/518、build-system、project 元数据 |
| `virtual-environments.md` | venv、conda、pyenv、版本管理 |
| `modern-toolchain.md` | ruff、mypy、pytest、pre-commit、GitHub Actions |

---

## 核心问题

1. `pyproject.toml` 如何取代 `setup.py`？
2. PEP 517/518 对构建后端的规定？
3. 虚拟环境的原理：为什么隔离了包但共享了标准库？
4. `uv` 和 `pip` 的核心差异？解析速度、缓存策略？

---

## 关联训练场

- `../mini-runtime/` — 项目结构、测试配置、CI 集成
