# APScheduler

APScheduler 是 Python 的轻量定时任务调度器，不依赖外部消息队列。

## 核心实现

```python
# scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import asyncio

scheduler = AsyncIOScheduler()

# 每 5 分钟执行
@scheduler.scheduled_job(IntervalTrigger(minutes=5))
async def check_health():
    print("Health check running...")

# Cron 表达式：每天 9:00
@scheduler.scheduled_job(CronTrigger(hour=9, minute=0))
async def daily_report():
    print("Sending daily report...")

# 动态添加任务
async def my_task(name: str):
    print(f"Task {name} executed")

scheduler.add_job(
    my_task,
    trigger='interval',
    seconds=10,
    args=['cleanup'],
    id='cleanup_task',
    replace_existing=True,
)

# 启动
async def main():
    scheduler.start()
    try:
        await asyncio.Event().wait()
    finally:
        scheduler.shutdown()

asyncio.run(main())
```

## 持久化

```python
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

jobstores = {
    'default': SQLAlchemyJobStore(url='sqlite:///jobs.sqlite')
}
scheduler = AsyncIOScheduler(jobstores=jobstores)
```
