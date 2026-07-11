"""
生产痛点：在编写 AI Webhook 或者多模态 Agent 框架时，我们需要把生成的结构化消息推送到不同的平台（企业微信、钉钉、Slack、飞书）。如果强制要求所有的自定义 Client 去继承同一个 BasePublisher，在集成第三方闭源 SDK 时会极度痛苦。
Protocol 解法：定义一个不依赖继承、但参数与返回值类型完全焊死的结构化契约，让 IDE 完美提示。
"""

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable


@dataclass
class AgentMessage:
    msg_id: str
    content: str
    metadata: dict[str, Any]


@runtime_checkable
class MessagePublisher(Protocol):
    channel_name: str

    def publish(self, message: AgentMessage) -> bool: ...


class LarkPublisher:
    def __init__(self, webhook_url: str) -> None:
        self.webhook_url = webhook_url
        self.channel_name = "lark"

    def publish(self, message: AgentMessage) -> bool:
        print(f"Publishing message to Lark: {message}")
        return True


class SlackPublisher:
    def __init__(self, token: str) -> None:
        self.token = token
        self.channel_name = "slack"

    def publish(self, message: AgentMessage) -> bool:
        print(f"[{self.channel_name}] Pushing to Slack channel: {message.content[:20]}")
        return True


class AgentNotificationHub:
    def __init__(self) -> None:
        self._publishers: list[MessagePublisher] = []

    def add_publisher(self, publisher: MessagePublisher) -> None:
        self._publishers.append(publisher)

    def broadcast(self, message: AgentMessage) -> None:
        for pub in self._publishers:
            if pub.publish(message):
                print(f"Successfully broadcasted to {pub.channel_name}")
