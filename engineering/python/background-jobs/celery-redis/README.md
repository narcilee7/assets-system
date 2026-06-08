# Python Celery + Redis

Celery 是 Python 生态最成熟的分布式任务队列。

## 核心实现

```python
# celery_app.py
from celery import Celery

app = Celery('myapp', broker='redis://localhost:6379/0', backend='redis://localhost:6379/0')

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=4,
)

# 任务定义
@app.task(bind=True, max_retries=3)
def send_email(self, to: str, subject: str, body: str):
    try:
        # 发送邮件逻辑
        print(f"Sending email to {to}")
        return {"sent": True}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)

@app.task
def process_order(order_id: str):
    print(f"Processing order {order_id}")
    return {"order_id": order_id, "status": "processed"}

# 调用
# send_email.delay("user@example.com", "Hello", "World")
# process_order.apply_async(args=["order-123"], countdown=60)
```

## 定时任务（Beat）

```python
# beat_schedule.py
from celery.schedules import crontab

app.conf.beat_schedule = {
    'cleanup-every-hour': {
        'task': 'tasks.cleanup',
        'schedule': crontab(minute=0),  # 每小时
    },
    'check-every-5-minutes': {
        'task': 'tasks.health_check',
        'schedule': 300.0,  # 5分钟
    },
}
```

## Flower 监控

```bash
celery -A celery_app flower --port=5555
```
