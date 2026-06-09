# Django ORM

Django ORM 是功能最完备的 Python ORM，深度集成于 Django 框架。

## 核心查询

```python
# 基础 CRUD
User.objects.create(name='Alice', email='alice@example.com')
User.objects.get(id=1)
User.objects.filter(age__gte=18).order_by('-created_at')
User.objects.all().count()

# 聚合
from django.db.models import Count, Avg, Sum
Order.objects.aggregate(total=Sum('amount'))
User.objects.annotate(order_count=Count('orders'))

# 事务
from django.db import transaction

with transaction.atomic():
    user = User.objects.create(name='Bob')
    Order.objects.create(user=user, amount=100)

# 原生 SQL
User.objects.raw('SELECT * FROM users WHERE age > %s', [18])

# 批量操作
User.objects.bulk_create([User(name=f'user{i}') for i in range(1000)])
Order.objects.filter(status='pending').update(status='processing')
```

## QuerySet 优化

```python
# 避免 N+1
# Bad
for user in User.objects.all():
    print(user.orders.count())

# Good
for user in User.objects.prefetch_related('orders').annotate(
    order_count=Count('orders')
):
    print(user.order_count)

# 延迟加载 vs 立即加载
users = User.objects.only('name', 'email')  # 仅加载指定字段
users = User.objects.defer('bio')            # 延迟加载 bio
```
