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

## L2：源码锚定与边界陷阱

### 源码锚定

| 组件 | 关键源码/配置 | 说明 |
|---|---|---|
| kube-proxy iptables | `pkg/proxy/iptables/proxier.go` 中 `syncProxyRules` | 遍历 Service/Endpoints，生成 `KUBE-SVC-XXX` / `KUBE-SEP-XXX` chain；规则数随 Service 规模 O(N²) 增长 |
| kube-proxy IPVS | `pkg/proxy/ipvs/proxier.go` 中 `syncProxyRules` | 使用 ipvsadm 管理虚拟服务；连接哈希表大小受 `ip_vs_conn_tab_size` 限制 |
| CoreDNS | `plugin/kubernetes/kubernetes.go` 中 `ServeDNS` | 通过 Kubernetes API watch Endpoints，DNS TTL 默认 5s；ndots 逻辑在 `plugin/rewrite` 中处理 |
| ingress-nginx | `rootfs/etc/nginx/lua/balancer.lua` | 动态 upstream 由 Lua 根据 Endpoints 变化实时更新，避免 nginx reload |
| EndpointSlice | `pkg/controller/endpointslice/endpointslice_controller.go` | 默认 100 endpoints 一个 slice，减少 watch 推送量 |

### 边界陷阱

1. **externalTrafficPolicy: Local 的流量黑洞**：节点上无对应 Pod 时，请求被丢弃（Connection Refused），不会跨节点转发； DaemonSet 部署可避免此问题
2. **CoreDNS ndots:5 导致解析风暴**：Pod 中 `search` 含 3 个域，查询短名称（如 `google.com`）会先尝试 `google.com.default.svc.cluster.local` 等 4 条，每次超时 5s，严重拖慢
3. **NodePort 端口范围冲突**：默认 30000-32767 与某些内核参数或宿主机服务冲突；大规模集群中可用端口耗尽
4. **iptables 规则数量爆炸**：Service 和 Endpoints 数量大时，`iptables -L` 可能达数万条，`syncProxyRules` 耗时秒级，更新期间新旧规则并存导致流量黑洞
5. **Ingress pathType Prefix 的贪婪匹配**：`path: /api` 会匹配 `/api/v1` 和 `/apiv1`（无斜杠时）；不同 Controller 实现不一致，迁移时行为可能变化
6. **sessionAffinity 与 IPVS 的 source hashing**：IPVS `sh` 算法在 Endpoint 变化时重哈希，会话可能被打到不同 Pod；iptables 的 `recent` 模块在高并发下性能差
7. **LoadBalancer health check 黑洞**：云厂商 LB 健康检查与 kubelet 健康检查逻辑不同，LB 认为节点健康但本地 kube-proxy 未就绪，导致 50% 流量丢包
8. **Headless Service 的 DNS A 记录**：返回所有 Pod IP，客户端需自行负载均衡；DNS 缓存导致客户端无法感知 Pod 变化，旧 IP 连接持续超时

## L3：可运行实验

> 实验目录：`systems-engineering/cloud-native/impl/ingress_lab/`

### 实验 1：Service 负载均衡模拟

```bash
cd systems-engineering/cloud-native/impl/ingress_lab
python3 service_lb.py --mode iptables --endpoints 10 --requests 1000
```

模拟 iptables 随机转发和 IPVS 一致性哈希的负载分布差异；输出各 Pod 接收请求数和最大偏差。

### 实验 2：DNS ndots 解析延迟

```bash
python3 dns_ndots.py --query google.com --ndots 5
```

模拟 Pod 内 `resolv.conf` 的 search 域拼接过程；统计 ndots 导致的额外查询次数和理论超时时间。

### 实验 3：Local 策略黑洞检测

```bash
python3 local_policy.py --nodes 3 --pods 2 --requests 100
```

模拟 3 节点集群中只有 2 个 Pod 时，`externalTrafficPolicy: Local` 下发往无 Pod 节点的请求被丢弃的比例。

## 核心追问

1. **Ingress 和 Service 的区别？** Service 是四层代理（TCP/UDP）；Ingress 是七层代理（HTTP/HTTPS），可以基于 host/path/route 做更细粒度的路由
2. **NodePort 和 Ingress 的选择？** NodePort 直接暴露节点端口，适合临时测试；Ingress 有更丰富的七层路由、SSL、rewrite 功能，适合生产
3. **为什么 Pod 无法访问 Service？** 检查 DNS 解析（nslookup）、kube-proxy 是否工作（iptables/IPVS）、Service 是否正确选择到 Pod（endpoints）
4. **externalTrafficPolicy: Local 的作用？** 保留客户端 IP；但只能路由到本地 Pod，如果本地没有 Pod 则不工作（适合有本地副本的场景）
5. **Service 的 sessionAffinity 是什么？** 让相同客户端 IP 的请求都打到同一个 Pod（基于 clientIP）；用于无 cookie 的会话保持

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| Kubernetes request path | L3 | done |
| pod lifecycle notes | L3 | done |
| resource requests and limits | L3 | done |
| ingress and service networking | L3 | done |
| operator pattern notes | L1 | todo |