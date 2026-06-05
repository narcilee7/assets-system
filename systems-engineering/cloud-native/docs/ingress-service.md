# Ingress and Service Networking

## 目标

理解 Kubernetes Service 的类型、Ingress 机制、DNS 工作原理，以及服务发现。

## 场景

- ClusterIP、NodePort、LoadBalancer 的区别？
- 如何选择 Ingress Controller？
- 为什么有时候 Service 无法访问？
- DNS 解析失败怎么排查？

## Service 类型

### ClusterIP（默认）

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-svc
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
  - port: 80        # Service port（集群内部访问）
    targetPort: 8080 # Container port
    protocol: TCP
```

**特点**：
- 集群内部 IP，仅 Kubernetes 内部访问
- kube-proxy 实现负载均衡（iptables/IPVS）
- 无外部暴露

### NodePort

```yaml
spec:
  type: NodePort
  ports:
  - port: 80        # Service port
    targetPort: 8080
    nodePort: 30080  # 节点端口（30000-32767）
```

**特点**：
- 在每个节点的 IP:nodePort 暴露
- 外部可通过 `<任意节点IP>:30080` 访问
- 依赖 kube-proxy

### LoadBalancer

```yaml
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
  externalTrafficPolicy: Cluster  # 或 Local
```

**特点**：
- 依赖云提供商的 LB（AWS ELB、GCP LB、Azure LB）
- 自动创建外部 LB
- `externalTrafficPolicy: Local` 保留客户端 IP

### ExternalName

```yaml
spec:
  type: ExternalName
  externalName: api.example.com
```

**特点**：
- DNS CNAME 记录，不是代理
- 用于服务映射到外部域名

## Ingress

### Ingress 资源

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /users
        pathType: Prefix
        backend:
          service:
            name: users-svc
            port:
              number: 80
      - path: /orders
        pathType: Prefix
        backend:
          service:
            name: orders-svc
            port:
              number: 80
  tls:
  - hosts:
    - api.example.com
    secretName: tls-secret
```

### Ingress Controller

```
Ingress Controller 实现：
  - nginx-ingress-controller
  - traefik
  - ambassador (Envoy based)
  - kong
  - Istio Gateway

流程：
  1. Ingress Controller 监听 Ingress 资源
  2. 根据规则配置内部反向代理（nginx/envoy）
  3. 将请求转发到 Service
```

### Ingress 常见注解

```yaml
annotations:
  # 重写规则
  nginx.ingress.kubernetes.io/rewrite-target: /$2
  
  # 连接超时
  nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
  
  # 速率限制
  nginx.ingress.kubernetes.io/limit-rps: "10"
  nginx.ingress.kubernetes.io/limit-connections: "100"
  
  # 跨域
  nginx.ingress.kubernetes.io/enable-cors: "true"
```

## DNS

### CoreDNS

```bash
# 查看 CoreDNS Pod
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 查看 Service
kubectl get svc kube-dns -n kube-system
# IP: 10.96.0.10

# /etc/resolv.conf in Pod
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

### DNS 解析

```bash
# Pod 内测试
kubectl exec -it <pod> -- nslookup kubernetes.default
kubectl exec -it <pod> -- nslookup my-svc.default.svc.cluster.local

# 完整格式
<service>.<namespace>.svc.cluster.local

# 简化（在同一 namespace）
<service>

# 跨 namespace
<service>.<namespace>
```

### DNS 缓存

```yaml
# CoreDNS 配置（ConfigMap）
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
      forward . 8.8.8.8  # 上游 DNS
      cache 30           # 缓存 30 秒
    }
```

## 服务发现

### 环境变量

```bash
# kubelet 为每个运行的 Pod 注入 env
# 格式：<SERVICE>_SERVICE_HOST, <SERVICE>_SERVICE_PORT

MY_SVC_SERVICE_HOST=10.0.5.100
MY_SVC_SERVICE_PORT=80

# 问题：
# - Pod 启动时创建，Service 创建后不会更新
# - 新 Pod 才能看到新 Service
```

### DNS（推荐）

```bash
# DNS 发现，不需要重启 Pod
curl http://my-svc:80
# 自动解析到 ClusterIP

# SRV 记录
# _http._tcp.my-svc.default.svc.cluster.local -> port 80
```

## 网络策略

### NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
```

## 核心追问

1. **Ingress 和 Service 的区别？** Service 是四层代理（TCP/UDP）；Ingress 是七层代理（HTTP/HTTPS），可以基于 host/path/route 做更细粒度的路由
2. **NodePort 和 Ingress 的选择？** NodePort 直接暴露节点端口，适合临时测试；Ingress 有更丰富的七层路由、SSL、rewrite 功能，适合生产
3. **为什么 Pod 无法访问 Service？** 检查 DNS 解析（nslookup）、kube-proxy 是否工作（iptables/IPVS）、Service 是否正确选择到 Pod（endpoints）
4. **externalTrafficPolicy: Local 的作用？** 保留客户端 IP；但只能路由到本地 Pod，如果本地没有 Pod 则不工作（适合有本地副本的场景）
5. **Service 的 sessionAffinity 是什么？** 让相同客户端 IP 的请求都打到同一个 Pod（基于 clientIP）；用于无 cookie 的会话保持

## 状态

| 资产 | 状态 |
|---|---|
| Kubernetes request path | done |
| pod lifecycle notes | done |
| resource requests and limits | done |
| ingress and service networking | done |
| operator pattern notes | todo |