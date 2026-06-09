# Service Discovery

微服务架构中，服务实例动态扩缩容，需要服务发现机制让调用方找到可用实例。

## 两种模式

| 模式 | 说明 | 代表 |
| --- | --- | --- |
| 客户端发现 | 客户端直接查询注册中心，选择实例 | Eureka + Ribbon |
| 服务端发现 | 请求发给负载均衡器，由它转发 | Kubernetes Service + Ingress |

## 核心实现

### 1. 基于 Consul 的服务注册与发现

```ts
// consul-discovery.ts
import Consul from 'consul';

const consul = new Consul({ host: 'localhost', port: 8500 });

export class ServiceRegistry {
  private serviceId: string;

  constructor(
    private serviceName: string,
    private port: number,
    private healthCheckPath: string = '/health',
  ) {
    this.serviceId = `${serviceName}-${crypto.randomUUID()}`;
  }

  async register() {
    await consul.agent.service.register({
      id: this.serviceId,
      name: this.serviceName,
      tags: ['nodejs', 'v1'],
      port: this.port,
      check: {
        http: `http://localhost:${this.port}${this.healthCheckPath}`,
        interval: '10s',
        timeout: '5s',
        deregistercriticalserviceafter: '30s',
      },
    });
    console.log(`Registered service: ${this.serviceId}`);
  }

  async deregister() {
    await consul.agent.service.deregister(this.serviceId);
    console.log(`Deregistered service: ${this.serviceId}`);
  }
}

// 服务发现
export async function discoverService(serviceName: string): Promise<{ host: string; port: number }[]> {
  const services = await consul.health.service({ service: serviceName, passing: true });
  return services.map((s: any) => ({
    host: s.Service.Address || s.Node.Address,
    port: s.Service.Port,
  }));
}

// 轮询负载均衡
export class RoundRobinBalancer {
  private index = 0;

  async getInstance(serviceName: string) {
    const instances = await discoverService(serviceName);
    if (!instances.length) throw new Error(`No healthy instances for ${serviceName}`);
    const instance = instances[this.index % instances.length];
    this.index++;
    return instance;
  }
}
```

### 2. Kubernetes 原生服务发现

```ts
// k8s-discovery.ts
// 在 K8s 中，使用 DNS 即可发现服务
// 如：http://user-service:3000/users

// 更高级：通过 K8s API 获取 Endpoints
import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';

const kc = new KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(CoreV1Api);

export async function getServiceEndpoints(namespace: string, serviceName: string) {
  const endpoints = await k8sApi.readNamespacedEndpoints(serviceName, namespace);
  const addresses: string[] = [];

  for (const subset of endpoints.body.subsets || []) {
    const ports = subset.ports?.map((p) => p.port) || [];
    for (const addr of subset.addresses || []) {
      for (const port of ports) {
        addresses.push(`${addr.ip}:${port}`);
      }
    }
  }

  return addresses;
}
```

### 3. 基于 DNS 的简单发现

```ts
// dns-discovery.ts
import dns from 'dns';
import { promisify } from 'util';

const resolveSrv = promisify(dns.resolveSrv);

export async function discoverViaDNS(serviceName: string): Promise<{ host: string; port: number }[]> {
  const records = await resolveSrv(`_${serviceName}._tcp.cluster.local`);
  return records.map((r) => ({ host: r.name, port: r.port }));
}
```

## 服务网格（Istio）

在现代云原生环境中，服务发现通常由服务网格透明处理：

```
[Service A] --(mTLS)--> [Istio Sidecar] --(负载均衡)--> [Service B Sidecar] --(mTLS)--> [Service B]
                              |
                              v
                        [Istiod / Control Plane]
```

> 使用 Kubernetes + Istio 时，应用无需关心服务发现，Sidecar 自动处理 DNS 解析、负载均衡、熔断、重试。
