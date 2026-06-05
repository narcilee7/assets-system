# Kubernetes Request Path

## 目标

理解一次请求从 Ingress 到 Pod 的完整路径，以及各组件如何协作。

## 场景

- 请求从外面进入 Kubernetes 集群的路径是什么？
- Service、Endpoint、kube-proxy 是如何工作的？
- Pod 网络和 Service 网络如何转换？
- Ingress Controller 的作用是什么？

## 请求路径概览

```
外部请求
    |
    v
Ingress Controller（nginx/ambassador）
    | 1. Ingress 规则匹配
    v
Service（ClusterIP）
    | 2. kube-proxy 负载均衡
    v
Endpoint（Pod IP）
    | 3. CNI 路由到 Pod
    v
Pod（容器）
    | 4. ServiceAccount Token
    v
Kube-apiserver（可选，Pod 访问 K8s API）
```

## 详细路径

### 1. Ingress

```
请求：GET /api/users HTTP/1.1
Host: api.example.com

Ingress Controller（nginx-ingress-controller）：
  1. 监听 Ingress 资源变化
  2. 解析规则：
     - host: api.example.com
     - path: /api
     - backend: serviceName=users-svc, servicePort=8080
  3. 将请求转发到 users-svc:8080
```

### 2. Service

```
Service 对象：
  metadata:
    name: users-svc
  spec:
    selector:
      app: users
    ports:
    - port: 80        # Service port
      targetPort: 8080  # Container port

Kubernetes DNS（CoreDNS）：
  - users-svc.default.svc.cluster.local 解析到 Service IP（ClusterIP）

ClusterIP 分配机制：
  - kube-apiserver 从 service-cluster-ip-range 分配
  - 虚拟 IP，不属于任何网卡
```

### 3. kube-proxy

```
kube-proxy 模式（iptables vs IPVS）：

iptables 模式（默认）：
  1. kube-proxy 为每个 Service 创建 iptables 规则
  2. DNAT：将 ClusterIP:port 转为 PodIP:port
  3. 负载均衡：概率分布

  iptables -t nat -L KUBE-SERVICES | grep users-svc
  --> KUBE-SVC-XXXX -> KUBE-SEP-XXXX (endpoint1)
                     -> KUBE-SEP-YYYY (endpoint2)

IPVS 模式（更高性能）：
  1. kube-proxy 使用 IPVS 代替 iptables
  2. IPVS 是内核级负载均衡
  3. 支持更多算法（rr, lc, sh, dh...）

  ipvsadm -L -n | grep users-svc
  --> TCP 10.0.5.100:80 rr
      -> 10.244.1.15:8080
      -> 10.244.2.23:8080
```

### 4. CNI 网络

```
CNI（Container Network Interface）：
  - Calico, Flannel, Weave, Cilium

从节点到 Pod：
  1. kube-proxy 选择 endpoint（Pod IP）
  2. 宿主机路由表：
     10.244.1.0/24 via 10.0.0.5 dev eth0

  跨节点通信：
    Node A -> Node B：
      1. 查路由表：10.244.1.0/24 via 10.0.0.5
      2. 通过 underlay 网络（VPC/物理网络）到 Node B
      3. Node B 的 CNI bridge 接收
      4. 转发到 veth pair -> Pod netns
```

### 5. Pod 网络命名空间

```
Pod 内的网络命名空间：
  - eth0@if100：veth pair 的 Pod 端
  - MAC 地址：容器启动时分配
  - IP：固定（如 10.244.1.15/24）

容器内路由：
  - 默认路由 via eth0
  - 访问 ClusterIP：通过 eth0 发到 CNI bridge

Service 访问（Pod 视角）：
  1. Pod 访问 users-svc.default.svc.cluster.local
  2. DNS 返回 ClusterIP（10.0.5.100）
  3. Pod 发 ARP 请求（谁有 10.0.5.100？）
  4. CNI bridge 回应（kube-proxy 注入的 iptables）
  5. 实际报文发往 endpoint Pod IP
```

## 完整路径时序

```
外部客户端
    |
    |-- SYN --> Ingress Controller (NodePort 80)
    |
Ingress Controller
    |-- 解析 Ingress 规则 -->
    |-- 转发到 Service ClusterIP:80 -->
    |
kube-proxy (iptables/IPVS)
    |-- DNAT: ClusterIP:80 -> PodIP:8080 -->
    |
CNI (Calico/Flannel)
    |-- 路由到目标 Pod 所在节点 -->
    |
目标节点
    |-- 转发到 veth pair -->
    |
Pod 容器
    |-- 接收 TCP SYN -->
    |-- <-- SYN-ACK -->
    |-- ACK -->
    |
应用层
    |-- HTTP Request: GET /api/users -->
    |-- 处理 -->
    |-- HTTP Response -->
```

## Pod 到 Pod 通信

```bash
# 查看 Pod IP
kubectl get pod -o wide

# 查看 Service Endpoints
kubectl get endpoints <service-name>

# 查看 Pod 网络配置
kubectl exec -it <pod> -- ip addr
kubectl exec -it <pod> -- ip route

# 测试 Pod 间连通性
kubectl exec -it <pod> -- curl http://<target-pod-ip>:8080
```

## L2：实现细节与边界

### kube-proxy 源码与 iptables 规则

在 Kubernetes 1.29 之前，iptables 是默认模式。kube-proxy 的 `proxier.go` (`pkg/proxy/iptables/proxier.go`) 负责：

1. 监听 Service/EndpointSlice 变化
2. 生成 iptables 规则链：
   - `KUBE-SERVICES`：匹配目标 ClusterIP + port
   - `KUBE-SVC-XXXX`：按概率分流到各 endpoint
   - `KUBE-SEP-YYYY`：DNAT 到具体 PodIP:targetPort

```bash
# 查看生成的规则（在节点上）
iptables -t nat -L KUBE-SERVICES -n | grep <service-name>
```

### Endpoint vs EndpointSlice

- **Endpoints**（v1）：早期 API，所有 endpoint 存于一个对象。Service 后端 > 1000 时成为瓶颈。
- **EndpointSlice**（discovery.k8s.io/v1）：将 endpoint 拆分为多个 slice（默认 100 个 endpoint/slice），kube-proxy 只需监听变更的 slice，大幅降低 API Server 和 kube-proxy 负载。

### conntrack 与短连接性能陷阱

```
iptables 模式下的 Service 访问：
  1. 出站报文命中 KUBE-SERVICES
  2. DNAT 到 PodIP
  3. conntrack 记录连接状态
  4. 回包时从 conntrack 反 DNAT

问题：
  - 高并发短连接（如 HTTP/1.0 无 keep-alive）会快速填满 conntrack table
  - 默认值 /proc/sys/net/netfilter/nf_conntrack_max ≈ 65536
  - 满后报文被 DROP，出现 "随机" 连接失败

解决：
  - 升高 nf_conntrack_max
  - 改用 IPVS 模式（连接表更大，支持更多算法）
  - 使用 eBPF/Cilium（绕过 conntrack）
```

### CoreDNS 解析路径

```
Pod 内应用查询 users-svc.default.svc.cluster.local
  └── /etc/resolv.conf 中 nameserver 指向 ClusterDNS (CoreDNS)
      └── CoreDNS 监听 53，加载 kubernetes plugin
          └── 查询 API Server 的 Service/Endpoint 资源
              └── 返回 ClusterIP
```

CoreDNS 配置中的 `cache 30` 表示正向查询缓存 30 秒。如果 Service 的 endpoint 发生变更，DNS 缓存会导致最多 30 秒的老旧解析。

## L3：可运行实验

见 `impl/k8s_lab/`。需要 Docker + kind + kubectl：

```bash
cd systems-engineering/cloud-native/impl/k8s_lab
./kind-setup.sh   # 创建本地集群并部署示例应用
./trace.sh        # 跟踪请求路径：endpoints -> iptables -> DNS -> 跨 Pod 访问
```

实验会验证：
- `kubectl get endpoints` 看到后端 Pod IP
- iptables `KUBE-SERVICES` 链中存在 DNAT 规则
- CoreDNS 能解析 `echo-svc.default.svc.cluster.local`

## 核心追问

1. **为什么 Ingress Controller 需要 NodePort 暴露？** Ingress Controller 需要一个固定入口，NodePort 在每个节点开放端口，让外部流量能进来
2. **ClusterIP 是怎么工作的？** ClusterIP 是虚拟 IP，kube-proxy 拦截对其的访问，通过 iptables/IPVS DNAT 到实际 Pod IP
3. **Pod 访问 Service 时怎么找到 PodIP 的？** Pod 通过 ServiceDNS 拿到 ClusterIP，发包时被 kube-proxy 的 iptables 规则拦截并 DNAT 成 PodIP
4. **CNI 的作用是什么？** CNI 负责为 Pod 分配 IP、设置路由、配置网络命名空间，让 Pod 能跨节点通信
5. **Ingress 和 Service 的区别？** Ingress 定义外部 HTTP/HTTPS 路由规则（host+path -> Service）；Service 定义 Pod 的访问方式（ClusterIP/NodePort/LoadBalancer）

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| Kubernetes request path | **L2+L3** | **done** |
| pod lifecycle notes | L1 | todo |
| resource requests and limits | L1 | todo |
| ingress and service networking | L1 | todo |
| operator pattern notes | L1 | todo |