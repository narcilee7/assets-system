import sys
import unittest
from pathlib import Path


PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))

from object_model.deep_copy import deep_copy


class Person:
    def __init__(self, name, tags):
        self.name = name
        self.tags = tags


class SlotBox:
    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value


class DeepCopyTest(unittest.TestCase):
    def test_copy_nested_containers(self):
        source = {"nums": [1, 2, {"x": 3}], "flags": {True, False}}

        copied = deep_copy(source)

        self.assertEqual(copied, source)
        self.assertIsNot(copied, source)
        self.assertIsNot(copied["nums"], source["nums"])
        self.assertIsNot(copied["nums"][2], source["nums"][2])

    def test_keep_shared_reference_shape(self):
        shared = ["same"]
        source = [shared, shared]

        copied = deep_copy(source)

        self.assertIsNot(copied, source)
        self.assertIs(copied[0], copied[1])
        self.assertIsNot(copied[0], shared)

    def test_copy_circular_list(self):
        source = []
        source.append(source)

        copied = deep_copy(source)

        self.assertIsNot(copied, source)
        self.assertIs(copied[0], copied)

    def test_copy_custom_object(self):
        source = Person("Ada", ["python"])

        copied = deep_copy(source)

        self.assertIsInstance(copied, Person)
        self.assertIsNot(copied, source)
        self.assertEqual(copied.name, "Ada")
        self.assertEqual(copied.tags, ["python"])
        self.assertIsNot(copied.tags, source.tags)

    def test_copy_slots_object(self):
        source = SlotBox({"answer": 42})

        copied = deep_copy(source)

        self.assertIsInstance(copied, SlotBox)
        self.assertEqual(copied.value, {"answer": 42})
        self.assertIsNot(copied.value, source.value)


if __name__ == "__main__":
    unittest.main()
