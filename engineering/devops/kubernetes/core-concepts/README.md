# Kubernetes Core Concepts

## 目标

训练 Kubernetes 核心概念：Pod、Service、Deployment、ConfigMap、Secret、PV/PVC、HPA。

## 核心对象

| 对象 | 作用 |
| --- | --- |
| Pod | 最小调度单元，一个或多个容器 |
| Service | 负载均衡和服务发现 |
| Deployment | Pod 的声明式管理、滚动更新 |
| ReplicaSet | Pod 副本数管理 |
| ConfigMap | 非敏感配置 |
| Secret | 敏感信息（Base64 编码） |
| PersistentVolume | 持久化存储 |
| PersistentVolumeClaim | 存储请求 |
| ServiceAccount | Pod 身份 |

## Pod

### 基本定义

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
    version: v1
spec:
  containers:
    - name: nginx
      image: nginx:1.25
      ports:
        - containerPort: 80
      resources:
        requests:
          memory: "64Mi"
          cpu: "250m"
        limits:
          memory: "128Mi"
          cpu: "500m"
      readinessProbe:
        httpGet:
          path: /healthz
          port: 80
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        tcpSocket:
          port: 80
        initialDelaySeconds: 15
        periodSeconds: 20
```

### Init Container

```yaml
spec:
  initContainers:
    - name: init-db
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "Waiting for database..."
          until nc -z db:5432; do
            sleep 1
          done
          echo "Database is ready"
  containers:
    - name: app
      image: myapp:v1
```

## Deployment

### 基本定义

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v1.0.0
          ports:
            - containerPort: 8080
```

### 滚动更新

```bash
# 更新镜像
kubectl set image deployment/myapp myapp=myapp:v2.0.0

# 查看滚动更新状态
kubectl rollout status deployment/myapp

# 回滚到上一个版本
kubectl rollout undo deployment/myapp

# 回滚到指定版本
kubectl rollout undo deployment/myapp --to-revision=2

# 查看历史
kubectl rollout history deployment/myapp
```

### 多容器 Pod

```yaml
spec:
  containers:
    - name: app
      image: myapp:v1
    - name: sidecar
      image: istio/proxyv2:1.19
      env:
        - name: ENVOY_PROMETHEUS_PORT
          value: "15090"
```

## Service

### Service Types

| Type | 说明 |
| --- | --- |
| ClusterIP | 集群内部访问（默认） |
| NodePort | 通过 Node IP:Port 访问 |
| LoadBalancer | 云厂商 LB（需要 cloud provider） |
| ExternalName | DNS CNAME 映射 |

### ClusterIP Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
    - name: http
      port: 80
      targetPort: 8080
    - name: grpc
      port: 50051
      targetPort: 50051
```

### NodePort Service

```yaml
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080  # 可选，指定端口
```

### Headless Service（无头服务）

```yaml
spec:
  clusterIP: None  # 无头服务
  selector:
    app: myapp
  ports:
    - port: 80
```

## ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  DATABASE_URL: "postgres://db:5432/app"
  LOG_LEVEL: "info"
  app.conf: |
    server:
      port: 8080
    features:
      feature_a: true
```

### 使用方式

```yaml
# 环境变量
envFrom:
  - configMapRef:
      name: myapp-config

# 环境变量（单个值）
env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: myapp-config
        key: LOG_LEVEL

# Volume 挂载
volumeMounts:
  - name: config
    mountPath: /app/config
volumes:
  - name: config
    configMap:
      name: myapp-config
```

## Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
type: Opaque
data:
  # echo -n "password" | base64
  DB_PASSWORD: cGFzc3dvcmQ=
  # TLS 证书
  TLS_CRT: LS0tLS1...
  TLS_KEY: LS0tLS1...
stringData:
  # 直接写明文（会自动 base64 编码）
  API_KEY: sk-xxxxx
```

### 使用方式

```yaml
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: myapp-secrets
        key: DB_PASSWORD

# Volume 挂载（TLS 等文件类型 secret）
volumeMounts:
  - name: tls-certs
    mountPath: /etc/tls
volumes:
  - name: tls-certs
    secret:
      secretName: myapp-secrets
```

## PersistentVolume / PersistentVolumeClaim

```yaml
# PersistentVolume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-data
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard
  hostPath:
    path: /data/pv

---
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
```

### 使用 PVC

```yaml
volumes:
  - name: data
    persistentVolumeClaim:
      claimName: pvc-data

volumeMounts:
  - name: data
    mountPath: /var/lib/data
```

## ResourceQuota & LimitRange

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: quota
spec:
  hard:
    pods: "10"
    services: "5"
    memory.request: "1Gi"
    memory.limit: "2Gi"

---
apiVersion: v1
kind: LimitRange
metadata:
  name: limits
spec:
  limits:
    - type: Container
      default:
        memory: "256Mi"
        cpu: "250m"
      defaultRequest:
        memory: "128Mi"
        cpu: "100m"
```

## 常用命令

```bash
# Pod 操作
kubectl get pods
kubectl describe pod nginx
kubectl logs nginx
kubectl exec -it nginx -- sh
kubectl port-forward pod/nginx 8080:80

# Deployment 操作
kubectl get deployments
kubectl scale deployment myapp --replicas=5
kubectl set image deployment/myapp myapp=myapp:v2

# Service 操作
kubectl get services
kubectl get svc
kubectl expose deployment myapp --type=LoadBalancer --port=80

# 调试
kubectl top pods  # 需要 metrics-server
kubectl get events
kubectl api-resources

# 滚动更新
kubectl rollout status deployment/myapp
kubectl rollout undo deployment/myapp
```

## 面试追问

- Pod 和容器有什么区别？
  （答：Pod 是 K8s 最小调度单元，可以包含多个容器；同一 Pod 的容器共享网络和存储）
- 为什么 Deployment 不直接管理 Pod？
  （答：中间加一层 ReplicaSet 实现副本数管理和滚动更新解耦）
- Service 如何实现负载均衡？
  （答：通过 kube-proxy 更新 iptables/ipvs 规则，实现 round-robin）
- 什么时候用 ConfigMap vs Secret？
  （答：ConfigMap 存非敏感配置，Secret 存敏感信息但也只是 base64 编码）

## 相关模式

- `deployment-strategies/`：滚动更新、蓝绿部署、金丝雀
- `monitoring-observability/`：K8s 监控
- `service-mesh/`：Sidecar 代理