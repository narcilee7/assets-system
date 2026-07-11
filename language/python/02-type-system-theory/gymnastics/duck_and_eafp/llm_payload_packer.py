from typing import Any


class Article:
    def __init__(self, title: str, content: str) -> None:
        self.title = title
        self.content = content

    def __str__(self) -> str:
        return f"Title: {self.title}\nContent: {self.content}"


class ChatMessage:
    def __init__(self, role: str, text: str) -> None:
        self.role = role
        self.text = text


class ChatSession:
    def __init__(self) -> None:
        self.messages: list[ChatMessage] = []

    def add(self, role: str, content: str) -> None:
        self.messages.append(ChatMessage(role, text=content))

    def __str__(self) -> str:
        return "\n".join(f"{msg.role}: {msg.text}" for msg in self.messages)


class LLMContextManager:
    @staticmethod
    def prepare_prompt(sp: str, user_data: Any) -> str:
        return f"=== SYSTEM ===\n{sp}\n\n=== CONTEXT ===\n{str(user_data)}"
