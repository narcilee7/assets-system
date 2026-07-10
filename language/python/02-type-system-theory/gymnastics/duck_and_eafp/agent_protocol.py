from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ExecutableAgent(Protocol):
    def run_action(
        self, action_name: str, payload: dict[str, Any]
    ) -> dict[str, Any]: ...

    @property
    def capability_tags(self) -> list[str]: ...


class OpenAIAgent:
    def __init__(self, tags: list[str]) -> None:
        self._tags = tags

    def run_actions(self, action_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "status": "success",
            "engine": "openai",
            "action": action_name,
        }

    @property
    def capability_tags(self) -> list[str]:
        return self._tags


class LegacyScript:
    """这是一个伪装成 Agent 的不合格鸭子（缺少 capability_tags）"""

    def run_action(self, action_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {"raw": "data"}
