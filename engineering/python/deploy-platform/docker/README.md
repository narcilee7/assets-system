# Python Docker Deployment

```dockerfile
# Dockerfile (多阶段构建)
FROM python:3.11-slim AS builder

WORKDIR /app
RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-interaction

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY ./app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 镜像优化

```dockerfile
# 使用非 root 用户
RUN groupadd -r appuser && useradd -r -g appuser appuser
USER appuser

# 禁用缓冲（日志立即输出）
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
```

## 构建命令

```bash
docker build -t myapp:latest .
docker run -p 8000:8000 --env-file .env myapp:latest
```
