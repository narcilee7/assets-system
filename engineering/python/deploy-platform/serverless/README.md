# Python Serverless

Python 是 Serverless 平台的原生支持语言（AWS Lambda、Vercel、Google Cloud Functions）。

## AWS Lambda

```python
# lambda_handler.py
def handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Hello from Lambda"}),
    }
```

```yaml
# serverless.yml
service: my-api
provider:
  name: aws
  runtime: python3.11
functions:
  api:
    handler: lambda_handler.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
```

## Vercel (Serverless Functions)

```python
# api/index.py
from fastapi import FastAPI
from vercel_kv import KV

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello from Vercel"}
```

## Mangum (ASGI on Lambda)

```python
# asgi_lambda.py
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello"}

# Lambda 入口
handler = Mangum(app)
```

## 冷启动优化

- 使用精简依赖（避免重型库）
- 使用 Lambda Layers 共享依赖
- 配置 Provisioned Concurrency
- 使用 Rust/C 扩展替代纯 Python
