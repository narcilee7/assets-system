# Python Password Hashing

Python 使用 passlib 进行密码哈希，bcrypt 和 argon2 是推荐算法。

## passlib 实现

```python
# password_service.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class PasswordService:
    @staticmethod
    def hash(password: str) -> str:
        return pwd_context.hash(password)
    
    @staticmethod
    def verify(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

# 使用
hashed = PasswordService.hash("mysecret")
assert PasswordService.verify("mysecret", hashed) == True
assert PasswordService.verify("wrong", hashed) == False
```

## Argon2（更安全）

```python
from passlib.hash import argon2

# Argon2 是密码哈希比赛冠军，抗 GPU/ASIC 攻击
hashed = argon2.hash("mysecret")
assert argon2.verify("mysecret", hashed)

# 配置参数
# time_cost: 迭代次数
# memory_cost: 内存用量（KB）
# parallelism: 并行线程数
```

## FastAPI 集成

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # 验证 token
    user = verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return user
```
