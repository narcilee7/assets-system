import inspect
from typing import Any, Callable, Literal, TypeVar, get_type_hints

T = TypeVar("T")


def llm_tool(fn: Callable[..., Any]) -> Callable[..., Any]:
    type_hints = get_type_hints(fn)
    sig = inspect.signature(fn)

    properties = {}
    required_fields = []

    for param_name, param in sig.parameters.items():
        if param.name not in type_hints:
            continue

        param_type = type_hints[param_name]

        if param_type is str:
            type_str = "string"
        elif param_type is int:
            type_str = "integer"
        elif param_type is float:
            type_str = "number"
        elif param_type is bool:
            type_str = "boolean"
        elif getattr(param_type, "__origin__", None) is Literal:
            type_str = "string"
            properties[param_name] = {
                "type": type_str,
                "enum": list(param_type.__args__),
            }
            if param.default == inspect.Parameter.empty:
                required_fields.append(param_name)
            continue
        else:
            type_str = "object"

        properties[param_name] = {"type": type_str}

        if param.default == inspect.Parameter.empty:
            required_fields.append(param_name)

    fn.__llm_schema__ = {
        "name": fn.__name__,
        "description": fn.__doc__ or "No description provided.",
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required_fields,
        },
    }

    return fn


@llm_tool
def fetch_user_metrics(
    user_id: int,
    metric_type: Literal["cpu", "memory", "io"],
    include_experimental: bool = False,
) -> dict[str, Any]:
    """Fetch real-time cluster metrics for a specific developer environment."""
    return {"status": "ok"}
