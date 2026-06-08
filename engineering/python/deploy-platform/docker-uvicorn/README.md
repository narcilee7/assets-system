# Python Docker Deployment

```dockerfile
# Dockerfile
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

## docker-compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/app
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  celery:
    build: .
    command: celery -A celery_app worker --loglevel=info
    depends_on:
      - redis
      - db

  celery-beat:
    build: .
    command: celery -A celery_app beat --loglevel=info
    depends_on:
      - redis
      - db

volumes:
  pgdata:
```

## 部署方式对比

| 方式 | 说明 |
| --- | --- |
| Uvicorn | ASGI 服务器，支持多 worker |
| Gunicorn + Uvicorn | 生产推荐，Gunicorn 管理 worker |
| Docker | 标准化部署 |
| K8s | 大规模编排 |
