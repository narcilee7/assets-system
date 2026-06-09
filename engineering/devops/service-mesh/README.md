# Service Mesh

## 目标

训练服务网格：Sidecar 代理、流量管理、可观测性、安全 mTLS。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Sidecar | 边车代理（Envoy） |
| Control Plane | 控制平面（管理代理） |
| Data Plane | 数据平面（流量转发） |
| mTLS | 双向 TLS 认证 |
| Canary Routing | 金丝雀路由 |
| Circuit Breaking | 熔断 |

## 架构

```
┌─────────────────────────────────────────────────────┐
│                  Control Plane                       │
│              (Istiod / Linkerd Controller)           │
└───────────────────────┬─────────────────────────────┘
                        │ xDS API
┌───────────────────────┴─────────────────────────────┐
│                    Data Plane                        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐         │
│  │ Sidecar │    │ Sidecar │    │ Sidecar │         │
│  │ Envoy   │◄──►│ Envoy   │◄──►│ Envoy   │         │
│  └────┬────┘    └────┬────┘    └────┬────┘         │
│       │              │              │               │
│   ┌───┴───┐      ┌───┴───┐      ┌───┴───┐         │
│   │ App A │      │ App B │      │ App C │         │
│   └───────┘      └───────┘      └───────┘         │
└─────────────────────────────────────────────────────┘
```

## Istio

### 注入 Sidecar

```bash
# 命名空间级别注入
kubectl label namespace production istio-injection=enabled

# Pod 级别注入（不需要标签）
kubectl get pod <pod-name> -o yaml | istioctl kube-inject -f - | kubectl apply -f -
```

### VirtualService（路由）

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
    - myapp
  http:
    - route:
        - destination:
            host: myapp
            subset: v1
          weight: 90
        - destination:
            host: myapp
            subset: v2
          weight: 10
```

### DestinationRule（熔断、连接池）

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: myapp
spec:
  host: myapp
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10000
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

### PeerAuthentication（mTLS）

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT  # STRICT = 必须 mTLS, PERMISSIVE = 可选
```

### Gateway（入口流量）

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: myapp-gw
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - myapp.example.com
      tls:
        httpsRedirect: true
    - port:
        number: 443
        name: https
        protocol: HTTPS
      hosts:
        - myapp.example.com
      tls:
        mode: SIMPLE
        credentialName: myapp-tls
```

## Linkerd

### 特点

- 更轻量（用 Rust 写的代理）
- 安全性开箱即用
- 简单易用

### 配置

```yaml
# 路由配置
apiVersion: linkerd.io/v1alpha2
kind: HTTPRoute
metadata:
  name: myapp
spec:
  hosts:
    - myapp
  routes:
    - condition:
        prefix: /
      weight: 100
      backends:
        - destination:
            group: ""
            kind: Service
            name: myapp-v1
            port: 80
          weight: 90
        - destination:
            group: ""
            kind: Service
            name: myapp-v2
            port: 80
          weight: 10
```

## 可观测性

```yaml
# Kiali Dashboard 集成（Istio）
# Prometheus 自动收集指标
# Jaeger 链路追踪

# 启用指标收集
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: mesh-default
  namespace: istio-system
spec:
  tracing:
    - providers:
        - name: jaeger
      randomSamplingPercentage: 10.0
```

## 面试追问

- Service Mesh 和 SDK 埋点的区别？
  （答：Service Mesh 无代码侵入，但只能处理 L4/L7 流量；SDK 更灵活但有侵入）
- Sidecar 性能开销？
  （答：延迟增加 ~2-3ms，内存 ~50MB/Pod）
- 什么时候需要 Service Mesh？
  （答：多服务通信、mTLS、细粒度流量控制、可观测性需求）

## 相关模式

- `kubernetes/`：K8s 部署
- `deployment-strategies/`：金丝雀部署
- `monitoring-observability/`：可观测性