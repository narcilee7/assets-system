"""
生产痛点：在写通用中间件（如 RPC 协议转换网关）时，我们需要一个通用的 Transformer。它的入参可能是某种原始网络帧（如 RawFrame），出参是业务 DTO（如 UserDTO）。由于涉及类型转化，如果类型变量不加型变约束（逆变/协变），Mypy 静态检查会直接疯狂报错，而纯写 Any 又会导致重构时完全没有静态保护。
Protocol 解法：利用泛型 Protocol 进行严格的型变约束。
"""

from typing import Protocol, TypeVar

# T_in 仅仅作为 【输入】参数，必须声明为逆变(contravariant)
T_in = TypeVar("T_in", contravariant=True)

# T_out 仅仅作为 【输出】参数，必须声明为协变(covariant)
T_out = TypeVar("T_out", covariant=True)


class DataTransformer(Protocol[T_in, T_out]):
    def transform(self, source: T_in) -> T_out: ...


class RawBytesPayload:
    def __init__(self, body: bytes) -> None:
        self.body = body


class DecodedJSONModel:
    def __init__(self, data: dict) -> None:
        self.data = data


class GatewayAuthTransformer:
    def transform(self, source: RawBytesPayload) -> DecodedJSONModel:
        import json

        parsed_dict = json.loads(source.body.decode("utf-8"))
        return DecodedJSONModel(parsed_dict)


def process_gateway_stream(
    payload: RawBytesPayload,
    transformer: DataTransformer[RawBytesPayload, DecodedJSONModel],
) -> DecodedJSONModel:
    return transformer.transform(payload)
