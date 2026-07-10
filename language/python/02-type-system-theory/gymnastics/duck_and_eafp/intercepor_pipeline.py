from collections.abc import Callable
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class InterceptorProtocol(Protocol):
    def before_execute(self, ctx: dict[str, Any]) -> None: ...

    def after_execute(self, ctx: dict[str, Any], result: Any) -> None: ...


class MetricsInterceptor:
    """指标统计拦截器：完全没有继承关系"""

    def before_execute(self, context: dict[str, Any]) -> None:
        context["start_time"] = 1000  # 模拟时间戳
        print("[Metrics] Started timing")

    def after_execute(self, context: dict[str, Any], result: Any) -> None:
        duration = 2000 - context["start_time"]  # 模拟耗时计算
        print(f"[Metrics] Execution took {duration}ms")


class LoggingInterceptor:
    """日志记录拦截器：同样是独立鸭子"""

    def before_execute(self, context: dict[str, Any]) -> None:
        print(f"[Log] Executing action: {context.get('action')}")

    def after_execute(self, context: dict[str, Any], result: Any) -> None:
        print(f"[Log] Action completed with result: {result}")


class TaskDispatcher:
    def __init__(self) -> None:
        self._interceptors: list[InterceptorProtocol] = []

    def register(self, interceptor: Any) -> None:
        if not isinstance(interceptor, InterceptorProtocol):
            raise TypeError("Object dose not conform to InterceptorProtocol...")

        self._interceptors.append(interceptor)

    def run_task(
        self, action: str, task_fn: Callable, *args: Any, **kwargs: Any
    ) -> Any:
        ctx = {"action": action}

        for interceptor in self._interceptors:
            interceptor.before_execute(ctx)

        result = task_fn(*args, **kwargs)

        for interceptor in reversed(self._interceptors):
            interceptor.after_execute(ctx, result)

        return result
