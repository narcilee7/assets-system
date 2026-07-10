from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Serializeble(Protocol):
    """定义“鸭子”的契约，只要是可以转化成字典，就是可以序列化的"""

    def to_dict(self) -> dict[str, Any]: ...


class EAPFTransformer:
    @staticmethod
    def extract_payload(obj: Any) -> dict[str, Any]:
        """
        放弃 isinstance或hasattr，直接假设对象符合最期望的协议
        """
        try:
            return obj.to_dict()
        except AttributeError:
            pass

        try:
            return {str(k): obj[k] for k in obj.keys()}
        except (AttributeError, TypeError, KeyError):
            pass

        try:
            return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
        except AttributeError:
            raise TypeError(
                f"Object of type '{type(obj).__name__}' is not extractable via EAFP."
            )
