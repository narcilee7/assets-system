# Distributed Lock Lab

## Files

| 文件 | 说明 |
|---|---|
| `redis_lock.py` | 模拟 Redis 单实例锁 + 看门狗续期；展示 TTL 不足时的竞争 |
| `redlock_sim.py` | 模拟 5 节点 RedLock 多数派加锁，引入延迟观察误判 |
| `zk_lock.py` | 用本地文件系统模拟 ZK 临时有序锁；统计 FIFO 公平性和吞吐 |
| `fencing_token.py` | 演示 fencing token 如何拒绝过期的延迟写，防止数据覆盖 |

## Quick Start

```bash
python3 redis_lock.py --ttl 5 --task-time 8
python3 redis_lock.py --ttl 5 --task-time 8 --watchdog
python3 redlock_sim.py --nodes 5 --quorum 3 --delay 0.15
python3 zk_lock.py --clients 5 --contention 30
python3 fencing_token.py --delay 2
```
