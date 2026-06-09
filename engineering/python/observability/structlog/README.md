# Python Structlog

structlog 是 Python 的结构化日志库，支持多种输出格式和上下文绑定。

## 核心实现

```python
# logger.py
import structlog
import logging
import sys

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer() if sys.stdout.isatty() == False else structlog.dev.ConsoleRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# 基础日志
logger.info("request_started", method="GET", path="/users")
logger.error("database_error", error="connection refused")

# 绑定上下文
bound_logger = logger.bind(request_id="abc-123", user_id="456")
bound_logger.info("user_action", action="login")
bound_logger.info("user_action", action="logout")

# 在 FastAPI 中使用
from fastapi import Request

async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.logger = logger.bind(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    
    response = await call_next(request)
    request.state.logger.info(
        "request_completed",
        status_code=response.status_code,
        duration_ms=calculate_duration(),
    )
    return response
```
