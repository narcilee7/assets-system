# Ingress & Service Lab

## Files

| 文件 | 说明 |
|---|---|
| `service_lb.py` | 对比 iptables 随机转发与 IPVS source-hashing 的负载分布 |
| `dns_ndots.py` | 模拟 Pod 内 resolv.conf 的 search 域拼接和 ndots 延迟 |
| `local_policy.py` | 模拟 `externalTrafficPolicy: Local` 在无 Pod 节点上的流量黑洞 |

## Quick Start

```bash
python3 service_lb.py --mode both --endpoints 10 --requests 10000
python3 dns_ndots.py --query google.com --ndots 5
python3 local_policy.py --nodes 5 --pods 3 --requests 5000
```
