# Operator Pattern Notes

## 目标

理解 Kubernetes Operator 的工作原理：CRD、Controller、Reconcile loop、Finalizer 和状态管理。

## 场景

- 如何用 Operator 自动化运维复杂应用？
- Controller 和 CRD 的关系是什么？
- 如何避免重复调和（reconcile）？
- Status 和 Spec 的区别？

## CRD（Custom Resource Definition）

### 定义 CRD

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.example.com
spec:
  group: example.com
  names:
    kind: Database
    plural: databases
    shortNames: [db]
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              engine:
                type: string
              version:
                type: string
              replicas:
                type: integer
          status:
            type: object
            properties:
              phase:
                type: string
              conditions:
                type: array
                items:
                  type: object
```

### 使用 CRD

```yaml
apiVersion: example.com/v1
kind: Database
metadata:
  name: my-db
spec:
  engine: postgres
  version: "14"
  replicas: 3
```

## Controller

### Controller 结构

```go
// 核心循环
for {
    // 1. 获取期望状态（从 apiserver）
    desired := &Database{}
    // 2. 获取当前状态
    current := &Database{}
    // 3. 调谐（Reconcile）
    if needsUpdate(current, desired) {
        update(current, desired)
    }
}
```

### Reconcile Loop

```go
func (r *DatabaseReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. 获取 Database 对象
    db := &examplev1.Database{}
    if err := r.Get(ctx, req.NamespacedName, db); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    
    // 2. 调谐
    if err := r.reconcileDatabase(db); err != nil {
        return ctrl.Result{}, err
    }
    
    // 3. 返回（可能需要 requeue）
    return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
}
```

### Watch 机制

```go
func (r *DatabaseReconciler) SetupWithManager(mgr manager.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&examplev1.Database{}).                 // 监控 Database
        Owns(&appsv1.StatefulSet{}).                 // 监控它创建的 StatefulSet
        Owns(&corev1.Service{}).                    // 监控它创建的 Service
        WithEventFilter(predicate.GenerationChangedPredicate{}).
        Complete(r)
}
```

## Finalizer

### 为什么需要 Finalizer

```
问题：删除 Database 时，需要清理外部资源（如云数据库实例）

如果没有 Finalizer：
  1. 用户删除 Database
  2. Kubernetes 删除对象
  3. Operator 永远不知道要清理外部资源

有 Finalizer：
  1. 用户删除 Database
  2. Kubernetes 看到 finalizer，不立即删除
  3. Operator 收到删除请求，开始清理
  4. 清理完成后，Operator 移除 finalizer
  5. Kubernetes 删除对象
```

### Finalizer 实现

```go
// 添加 finalizer
if !contains(db.Finalizers, "database.example.com") {
    db.Finalizers = append(db.Finalizers, "database.example.com")
    if err := r.Update(ctx, db); err != nil {
        return ctrl.Result{}, err
    }
}

// reconcile 中处理删除
if db.DeletionTimestamp != nil {
    // 清理外部资源
    if err := r.cleanupExternal(db); err != nil {
        return ctrl.Result{}, err
    }
    // 移除 finalizer
    db.Finalizers = remove(db.Finalizers, "database.example.com")
    if err := r.Update(ctx, db); err != nil {
        return ctrl.Result{}, err
    }
    return ctrl.Result{}, nil
}
```

## Status 管理

### 更新 Status

```go
// 在 reconcile 中更新 status
func (r *DatabaseReconciler) updateStatus(db *examplev1.Database, phase string) error {
    db.Status.Phase = phase
    db.Status.ObservedGeneration = db.Generation
    return r.Status().Update(ctx, db)
}
```

### 状态设计

```yaml
status:
  phase: Running  # Running, Creating, Scaling, Error
  conditions:
  - type: Ready
    status: "True"
    lastTransitionTime: "2024-01-01T00:00:00Z"
    reason: "ReplicasReady"
    message: "3/3 replicas ready"
  - type: DataReady
    status: "True"
    lastTransitionTime: "2024-01-01T00:01:00Z"
  replicas: 3
  readyReplicas: 3
```

## 常用模式

### 1. Create Or Update

```go
// 创建或更新（如果存在就更新）
func (r *DatabaseReconciler) createOrUpdate(sts *appsv1.StatefulSet) error {
    existing := &appsv1.StatefulSet{}
    err := r.Get(ctx, client.ObjectKeyFrom(sts), existing)
    if err != nil {
        if apierrors.IsNotFound(err) {
            return r.Create(ctx, sts)
        }
        return err
    }
    // 更新
    sts.ResourceVersion = existing.ResourceVersion
    return r.Update(ctx, sts)
}
```

### 2. 幂等调和

```go
// 幂等：只更新需要的部分
func (r *DatabaseReconciler) reconcileStatefulSet(db *examplev1.Database) error {
    sts := r.desiredStatefulSet(db)
    existing := &appsv1.StatefulSet{}
    if err := r.Get(ctx, client.ObjectKeyFrom(sts), existing); err != nil {
        return err
    }
    
    // 比较关键字段，不比较 timestamp、resourceVersion
    if existing.Spec.Replicas != sts.Spec.Replicas {
        existing.Spec.Replicas = sts.Spec.Replicas
        return r.Update(ctx, existing)
    }
    return nil
}
```

### 3. 错误重试

```go
// reconcile 错误时 requeue
func (r *DatabaseReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    if err := r.doReconcile(ctx, req); err != nil {
        // 指数退避 requeue
        return ctrl.Result{
            RequeueAfter: time.Duration(math.Pow(2, float64(requeueCount))) * time.Second,
        }, nil
    }
    return ctrl.Result{}, nil
}
```

## Helm vs Operator

| 维度 | Helm | Operator |
|---|---|---|
| 管理方式 | Template + Values | Custom Resource + Controller |
| 状态管理 | 无状态 | 有状态（通过 Status 反馈） |
| 复杂度 | 简单 | 复杂 |
| 适用场景 | 配置管理、简单部署 | 有复杂运维逻辑的应用 |
| 升级 | Template 渲染 | 业务逻辑控制 |

## 核心追问

1. **Controller 和 CRD 的关系？** CRD 定义资源结构（Spec/Status）；Controller 监听 CRD 资源变化并调谐实际状态到期望状态
2. **Reconcile 为什么是幂等的？** 可能被调用多次（controller 重启、error requeue）；所以要先 Get 实际状态，再决定是否 Update
3. **Finalizer 的作用？** 在对象删除前执行清理逻辑（如删除外部资源）；避免删除对象后清理逻辑没机会执行
4. **Status 和 Spec 的区别？** Spec 是用户定义的期望状态（用户输入）；Status 是系统反馈的实际状态（系统输出）
5. **为什么需要 blockOwnerDeletion？** 确保 Owner 对象先删除，防止孤立的 Dependent 被垃圾收集器意外删除

## 状态

| 资产 | 状态 |
|---|---|
| Kubernetes request path | done |
| pod lifecycle notes | done |
| resource requests and limits | done |
| ingress and service networking | done |
| operator pattern notes | done |