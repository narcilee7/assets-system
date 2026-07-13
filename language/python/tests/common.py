"""Test helpers: make training-ground sub-packages importable."""

import sys
from pathlib import Path

_TRAINING_ROOT = Path(__file__).resolve().parents[1]

for _name in (
    "runtime-model",
    "core-abstractions",
    "standard-library",
    "concurrency",
    "engineering-patterns",
    "mini-runtime",
):
    _path = str(_TRAINING_ROOT / _name)
    if _path not in sys.path:
        sys.path.insert(0, _path)
