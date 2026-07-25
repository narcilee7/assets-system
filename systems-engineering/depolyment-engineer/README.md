# Abourt Deployment

如果站在**历史演进**的角度，容器编排其实是一部云计算基础设施不断抽象的历史。

建议整个知识体系按下面这条主线学习，而不是直接背 Kubernetes API。

```
Physical Machine
        │
        ▼
Virtual Machine (VMware / Xen / KVM)
        │
        ▼
Configuration Management
(Puppet / Chef / Ansible)
        │
        ▼
Container
(LXC → Docker)
        │
        ▼
Single Host Container Management
(docker run / docker compose)
        │
        ▼
Cluster Resource Management
(Mesos / Borg)
        │
        ▼
Container Orchestration
(Kubernetes / Swarm / Nomad)
        │
        ▼
Cloud Native
(Service Mesh / GitOps / Serverless)
        │
        ▼
Platform Engineering
(IDP、Golden Path、AI Ops)
```

这就是整个 Map。

---

# 第一阶段：为什么需要容器？

最开始只有物理机。

```
Application
Application
Application
------------
Linux
------------
Server
```

问题：

* 环境冲突
* 资源浪费
* 部署困难
* 一个程序拖死整个机器

于是出现 VM。

```
VM1
 Linux
 App

VM2
 Linux
 App

Hypervisor
------------
Physical
```

优点：

* 隔离

缺点：

* 一个 VM 一个 OS
* 几 GB
* 启动几十秒甚至几分钟

所以大家开始寻找更轻量的方法。

---

# 第二阶段：Container

Linux 已经有很多基础能力：

* namespace
* cgroups
* chroot
* union filesystem

Docker 做的事情其实很简单：

> 把 Linux 内核已有能力包装成产品。

于是：

```
Container

App
Lib
-----------
Host Linux Kernel
```

Container：

共享 Kernel。

所以：

* 秒级启动
* MB 级
* 可复制
* 环境一致

Docker 真正革命的是：

Image。

```
Dockerfile

↓

Image

↓

Container
```

Infrastructure became code.

---

# 第三阶段：Docker 为什么不够？

很多新人会认为：

Docker = Kubernetes

其实完全不是。

Docker 解决的是：

> 一个容器。

但是生产环境：

```
100

1000

10000

Container
```

开始出现大量问题：

部署：

```
docker run

docker run

docker run

docker run
```

崩了怎么办？

```
docker ps

docker restart
```

升级怎么办？

```
stop

remove

pull

run
```

机器挂了？

迁移？

扩容？

日志？

网络？

服务发现？

负载均衡？

已经无法人工管理。

所以：

需要 Orchestration。([Snyk][1])

---

# 第四阶段：Google 其实早解决了

Google 比 Docker 早很多。

Google 内部：

2003 左右：

Borg。

Google 几百万 Container：

```
Search

Maps

Gmail

YouTube
```

全部跑在 Borg。

后来发现：

Borg 太复杂。

于是：

Omega。

后来：

2014

Google：

开源一个简化版：

Kubernetes。

所以很多设计：

其实来自 Borg。([IBM][2])

---

# 第五阶段：Container Orchestrator 百家争鸣

2014~2017：

三国时代。

## Docker Swarm

Docker 官方。

特点：

```
Docker CLI

↓

Swarm
```

简单。

适合：

几十机器。

---

## Mesos

Mesos 更像：

Cluster OS。

它管理：

```
CPU

Memory

Disk

Network
```

Container 只是其中一种任务。

Mesos 可以运行：

* Hadoop
* Spark
* Docker
* JVM
* Python

所以：

Mesos

不是 Container 平台。

而是：

Resource Scheduler。

Marathon 才负责部署。([TechTarget][3])

---

## Kubernetes

Google 思路：

Everything is Declarative.

你告诉它：

```
我要 5 个副本
```

而不是：

```
启动
停止
删除
```

这是思想上的巨大变化。

---

# 第六阶段：Kubernetes 为什么赢了？

因为 Kubernetes 提出了几个革命性的思想。

## 1 Desired State

不是：

```
Run
```

而是：

```
spec:
 replicas:3
```

Controller：

不断：

```
Current

↓

Desired
```

自动修复。

这叫：

Reconciliation Loop。([Kubernetes][4])

---

## 2 Everything is API

```
Pod

Deployment

Service

ConfigMap

Secret
```

全部：

REST Resource。

因此：

kubectl

其实就是：

REST Client。

---

## 3 Controller Pattern

Controller：

一直：

```
Observe

↓

Compare

↓

Act
```

整个 Kubernetes：

就是：

几百个 Controller。

---

## 4 Declarative

不是：

```
docker run
```

而是：

```
deployment.yaml
```

Infrastructure as Code。

---

# 第七阶段：Cloud Native

后来：

容器已经不是重点。

重点：

Cloud Native。

于是：

围绕 Kubernetes：

开始出现：

```
Ingress

Helm

Prometheus

Istio

ArgoCD

Tekton

Knative

KEDA

OPA

Cilium

CRI

CSI

CNI
```

形成 CNCF 全家桶。

Kubernetes 成为了：

Kernel。

其它：

都是插件。

---

# 第八阶段：今天的平台工程

今天很多公司：

并不是让业务开发：

直接写 Kubernetes。

而是：

```
Developer

↓

Internal Platform

↓

Kubernetes

↓

Cloud
```

开发者：

只关心：

```
Deploy()

Rollback()

Scale()
```

平台团队：

负责：

Kubernetes。

所以：

现在很多岗位叫：

Platform Engineer。

---

# 面试复习 RoadMap（建议顺序）

按照工程演进学习，知识会自然串联起来：

```
Part 1  Linux 基础
    namespace
    cgroups
    OverlayFS

↓

Part 2 Docker
    Image
    Layer
    Registry
    Network
    Volume

↓

Part 3 Container Runtime
    OCI
    runc
    containerd
    CRI

↓

Part 4 Kubernetes Architecture
    Master
    Node
    API Server
    etcd
    Scheduler
    Controller

↓

Part 5 Kubernetes Objects
    Pod
    ReplicaSet
    Deployment
    Service
    ConfigMap
    Secret
    StatefulSet
    DaemonSet
    Job

↓

Part 6 Scheduling
    Node
    Affinity
    Taint
    Priority
    Resource QoS

↓

Part 7 Networking
    CNI
    Service
    kube-proxy
    CoreDNS
    Ingress

↓

Part 8 Storage
    Volume
    PV
    PVC
    StorageClass
    CSI

↓

Part 9 运维
    Rolling Update
    HPA
    Metrics
    Logging
    Monitoring
    Backup

↓

Part 10 Cloud Native Ecosystem
    Helm
    Prometheus
    Istio
    ArgoCD
    Operator
```

对于面试而言，这条路线的核心逻辑可以概括为一句话：

**Linux 提供隔离（namespace/cgroups）→ Docker 提供容器与镜像 → Kubernetes 提供声明式控制与集群调度 → Cloud Native 将 Kubernetes 扩展为现代应用平台。** 这是目前大多数中高级后端、Go、DevOps、SRE 和平台工程岗位最主流的知识主线。([Kubernetes][4])

[1]: https://snyk.io/articles/container-security/container-orchestration/?utm_source=chatgpt.com "What is container orchestration? | Snyk"
[2]: https://www.ibm.com/think/topics/kubernetes-history?utm_source=chatgpt.com "The History of Kubernetes | IBM"
[3]: https://www.techtarget.com/searchitoperations/tip/Compare-container-orchestrators-Apache-Mesos-vs-Kubernetes?utm_source=chatgpt.com "Compare container orchestrators Apache Mesos vs. Kubernetes | TechTarget"
[4]: https://kubernetes.io/docs/concepts/overview/?utm_source=chatgpt.com "Overview | Kubernetes"
