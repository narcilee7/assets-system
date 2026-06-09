# RQ & Huey

RQ（Redis Queue）和 Huey 是轻量级的 Python 任务队列，适合中小型项目。

## RQ

```python
# rq_example.py
from redis import Redis
from rq import Queue
from rq.job import Job

redis_conn = Redis()
q = Queue(connection=redis_conn)

# 定义任务
def count_words(url):
    import requests
    resp = requests.get(url)
    return len(resp.text.split())

# 入队
job = q.enqueue(count_words, 'https://example.com')
print(job.id)  # 任务 ID

# 获取结果（阻塞）
result = job.result  # None（还未完成）

# Worker 启动
# rq worker --url redis://localhost:6379
```

## Huey

```python
# huey_config.py
from huey import RedisHuey

huey = RedisHuey('myapp', host='localhost')

@huey.task()
def add_numbers(a, b):
    return a + b

@huey.periodic_task(crontab(minute='0', hour='*'))
def hourly_cleanup():
    print("Running cleanup...")

# 调用
result = add_numbers(1, 2)
result.get(blocking=True)  # 3

# Worker 启动
# huey_consumer.py huey_config.huey
```

## 选型对比

| 维度 | Celery | RQ | Huey |
| --- | --- | --- | --- |
| 依赖 | 多（kombu、amqp） | 少（redis） | 极少 |
| 定时任务 | 强（beat） | 无（需 cron） | 内置 |
| 监控 | Flower | rq-dashboard | 无 |
| 推荐场景 | 大型项目 | 中型项目 | 小型项目 |
