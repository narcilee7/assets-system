import unittest

import tests.common  # noqa: F401
from descriptors.cached_property import cached_property
from descriptors.field_validator import Field, ValidationError
from descriptors.mini_dataclass import mini_dataclass
from descriptors.property import Property


class PropertyTest(unittest.TestCase):
    def test_getter(self):
        class Rect:
            def __init__(self, w, h):
                self.w = w
                self.h = h

            @Property
            def area(self):
                return self.w * self.h

        r = Rect(2, 3)
        self.assertEqual(r.area, 6)

    def test_setter(self):
        class Rect:
            def __init__(self, w, h):
                self.w = w
                self.h = h

            @Property
            def area(self):
                return self.w * self.h

            @area.setter
            def area(self, value):
                self.w = self.h = value**0.5

        r = Rect(2, 8)
        r.area = 16
        self.assertEqual(r.w, 4)

    def test_read_only(self):
        class Box:
            @Property
            def name(self):
                return "box"

        b = Box()
        with self.assertRaises(AttributeError):
            b.name = "other"


class CachedPropertyTest(unittest.TestCase):
    def test_caches_value(self):
        class Circle:
            def __init__(self, r):
                self.r = r

            @cached_property
            def area(self):
                return 3.14 * self.r * self.r

        c = Circle(2)
        self.assertEqual(c.area, 12.56)
        self.assertEqual(c.area, 12.56)

    def test_stored_in_instance_dict(self):
        class Circle:
            def __init__(self, r):
                self.r = r

            @cached_property
            def area(self):
                return 3.14 * self.r * self.r

        c = Circle(2)
        _ = c.area
        self.assertIn("area", c.__dict__)


class FieldValidatorTest(unittest.TestCase):
    def test_type_validation(self):
        class User:
            age = Field(type_=int)

        u = User()
        u.age = 30
        self.assertEqual(u.age, 30)
        with self.assertRaises(ValidationError):
            u.age = "thirty"

    def test_range_validation(self):
        class User:
            age = Field(type_=int, min_value=0, max_value=150)

        u = User()
        with self.assertRaises(ValidationError):
            u.age = -1

    def test_regex_validation(self):
        class User:
            email = Field(type_=str, regex=r"^[^@]+@[^@]+$")

        u = User()
        u.email = "a@b.com"
        with self.assertRaises(ValidationError):
            u.email = "not-an-email"


class MiniDataclassTest(unittest.TestCase):
    def test_init_repr_eq(self):
        @mini_dataclass
        class Person:
            name: str
            age: int = 0

        p1 = Person("Ada", age=30)
        p2 = Person("Ada", age=30)
        self.assertEqual(repr(p1), "Person(name='Ada', age=30)")
        self.assertEqual(p1, p2)

    def test_field_validation(self):
        @mini_dataclass
        class Config:
            host: str = "localhost"
            port: int = Field(type_=int, min_value=1, max_value=65535)

        cfg = Config(port=8080)
        self.assertEqual(cfg.port, 8080)
        with self.assertRaises(ValidationError):
            cfg.port = 0


if __name__ == "__main__":
    unittest.main()
