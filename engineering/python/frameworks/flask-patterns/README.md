# Flask Patterns

Flask 是轻量灵活的 Python Web 框架，适合小型服务和微服务。

## 应用工厂模式

```python
# app.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(f'config.{config_name}')
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    from .api import users, orders
    app.register_blueprint(users.bp, url_prefix='/api/users')
    app.register_blueprint(orders.bp, url_prefix='/api/orders')
    
    return app
```

## Blueprint 路由

```python
# api/users.py
from flask import Blueprint, request, jsonify
from app.models import User

bp = Blueprint('users', __name__)

@bp.route('/', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{'id': u.id, 'name': u.name} for u in users])

@bp.route('/', methods=['POST'])
def create_user():
    data = request.get_json()
    user = User(name=data['name'], email=data['email'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'id': user.id}), 201
```

## Flask vs FastAPI

| 维度 | Flask | FastAPI |
| --- | --- | --- |
| 异步 | 需扩展 | 原生支持 |
| 类型安全 | 无 | Pydantic |
| 自动文档 | 需扩展 | OpenAPI/Swagger |
| 性能 | 中等 | 高（Starlette） |
| 生态 | 极大 | 快速增长 |
| 推荐场景 | 小型/传统项目 | 新 API 项目 |
