# Django Patterns

Django 是 Python 最成熟的 Web 框架， batteries-included 设计。

## 项目结构

```
myproject/
  manage.py
  myproject/
    settings.py
    urls.py
    wsgi.py
  apps/
    users/
      models.py
      views.py
      serializers.py
      urls.py
      tests.py
```

## 核心模式

```python
# models.py
from django.db import models

class User(models.Model):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending')

# views.py (CBV)
from rest_framework import generics

class OrderListCreateView(generics.ListCreateAPIView):
    queryset = Order.objects.select_related('user').all()
    serializer_class = OrderSerializer

# serializers.py
from rest_framework import serializers

class OrderSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'user', 'user_email', 'amount', 'status']

# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('orders/', views.OrderListCreateView.as_view()),
]
```

## Django ORM 优化

```python
# N+1 问题
orders = Order.objects.all()  # 1 次查询
for o in orders:
    print(o.user.name)  # N 次查询

# 解决：select_related（单表 JOIN）
orders = Order.objects.select_related('user').all()

# prefetch_related（多表/多对多）
users = User.objects.prefetch_related('orders').all()
```
