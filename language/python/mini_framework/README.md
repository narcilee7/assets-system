# Mini Framework 层

这一层训练把多个基础机制组合成小框架。它不是为了造轮子上线，而是为了理解框架设计时的核心抽象。

## 推荐项目

| 项目 | 文件 / 目录 | 状态 | 关键点 |
| --- | --- | --- | --- |
| mini Router | `mini_router.py` | todo | 路由注册、dispatch、异常处理 |
| mini FastAPI | `mini_fastapi/` | todo | router、dependency、response model |
| mini ORM | `mini_orm/` | todo | Field、Model、Query |
| mini pytest | `mini_pytest/` | todo | test discovery、assert、fixture |
| mini task queue | `mini_task_queue/` | todo | worker、retry、ack |
| mini Agent Runtime | `mini_agent_runtime/` | todo | plan、tool、event stream |

## 练习原则

先写最小闭环，再加能力。比如 mini Router 的第一版只需要支持注册和分发；第二版再加 path params；第三版再加 middleware；第四版再加 dependency injection。
