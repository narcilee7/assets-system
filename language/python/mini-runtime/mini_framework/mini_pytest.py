"""
手写 mini pytest。

考点：
- 测试收集：扫描模块中 TestCase / test_ 函数。
- fixture：setup/teardown 或依赖注入。
- 简单断言和错误报告。
"""

from __future__ import annotations

import importlib.util
import inspect
import traceback
from collections.abc import Callable
from pathlib import Path
from typing import Any


class MiniPytest:
    """Minimal test runner inspired by pytest."""

    def __init__(self) -> None:
        self._collected: list[tuple[str, Callable[[], Any]]] = []
        self._results: list[tuple[str, str, str | None]] = []

    def collect(self, path: Path) -> None:
        """Collect ``test_*`` functions from a Python file."""
        spec = importlib.util.spec_from_file_location(path.stem, path)
        if spec is None or spec.loader is None:
            return
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        for name, obj in inspect.getmembers(module):
            if name.startswith("test_") and callable(obj):
                self._collected.append((f"{path.stem}::{name}", obj))

    def run(self) -> int:
        failures = 0
        for name, test in self._collected:
            try:
                test()
                self._results.append((name, "passed", None))
            except AssertionError as exc:
                failures += 1
                self._results.append((name, "failed", str(exc)))
            except Exception:
                failures += 1
                self._results.append((name, "error", traceback.format_exc()))
        return failures

    def report(self) -> None:
        for name, status, detail in self._results:
            print(f"{name} ... {status}")
            if detail:
                print(detail)


# Built-in assertion helpers.
def assert_eq(a: Any, b: Any) -> None:
    if a != b:
        raise AssertionError(f"{a!r} != {b!r}")


def assert_true(expr: bool) -> None:
    if not expr:
        raise AssertionError(f"expected truthy, got {expr!r}")


if __name__ == "__main__":
    runner = MiniPytest()
    runner.collect(Path(__file__))
    failures = runner.run()
    runner.report()
    print(f"failures: {failures}")
