# Python API Error Model

Python（FastAPI/Django/Flask）的异常处理机制让错误模型设计比 Go 更直观。

## 核心实现

```python
# errors.py
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid

class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        retryable: bool = False,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.retryable = retryable
        self.trace_id = None

    def to_dict(self):
        return {
            "code": self.code,
            "message": self.message,
            "status_code": self.status_code,
            "details": self.details,
            "trace_id": self.trace_id,
            "retryable": self.retryable,
        }

class Errors:
    @staticmethod
    def validation(details: Optional[Dict] = None):
        return AppError("VALIDATION_ERROR", "Request validation failed", 400, details)

    @staticmethod
    def unauthorized():
        return AppError("UNAUTHORIZED", "Authentication required", 401)

    @staticmethod
    def not_found(resource: str):
        return AppError("NOT_FOUND", f"{resource} not found", 404)

    @staticmethod
    def rate_limited():
        return AppError("RATE_LIMITED", "Too many requests", 429, retryable=True)

    @staticmethod
    def internal():
        return AppError("INTERNAL_ERROR", "Internal server error", 500)
```

## FastAPI 全局异常处理

```python
# exception_handlers.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from .errors import AppError

app = FastAPI()

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    exc.trace_id = request.headers.get("x-trace-id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace_id = request.headers.get("x-trace-id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": str(exc) if os.getenv("DEBUG") else "Internal server error",
            "trace_id": trace_id,
        },
    )
```

## Pydantic 验证

```python
# schemas.py
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    age: Optional[int] = Field(None, ge=0, le=150)
    password: str = Field(..., min_length=8)
    role: str = Field("user", regex="^(user|admin)$")

    @validator('password')
    def strong_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain digit')
        return v
```
