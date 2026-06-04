# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 登录事件     │    │ 登录 QPS     │    │ 认证链路    │
│ 失败事件     │    │ Token 验证   │    │ 权限检查   │
│ 异常事件     │    │ 延迟分布     │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 登录日志

```json
{
  "event": "auth.login.success",
  "user_id": "user-01HV3WWZP...",
  "email": "user@example.com",
  "device_id": "device-abc",
  "ip": "1.2.3.4",
  "user_agent": "Mozilla/5.0 ...",
  "timestamp": "2024-06-01T10:00:00.000Z"
}
```

### 登录失败日志

```json
{
  "event": "auth.login.failure",
  "email": "user@example.com",
  "ip": "1.2.3.4",
  "reason": "invalid_password",
  "failed_attempts": 2,
  "timestamp": "2024-06-01T10:00:05.000Z"
}
```

### Token 撤销日志

```json
{
  "event": "auth.token.revoked",
  "user_id": "user-01HV3WWZP...",
  "reason": "logout",
  "timestamp": "2024-06-01T10:30:00.000Z"
}
```

---

## 2. 指标（Metrics）

### 登录指标

```prometheus
# 登录请求
auth_login_requests_total{status="success"} 123456
auth_login_requests_total{status="failure"} 234

# 登录延迟
auth_login_duration_seconds{quantile="0.99"} 0.045

# Token 验证
auth_token_verifications_total{status="valid"} 1234567
auth_token_verifications_total{status="invalid"} 123
```

### 安全指标

```prometheus
# 暴力破解检测
auth_brute_force_attempts_total{ip="1.2.3.4"} 5

# 异常登录
auth_anomalous_logins_total 12

# Token 撤销
auth_tokens_revoked_total{reason="logout"} 890
auth_tokens_revoked_total{reason="password_changed"} 45
```

---

## 3. 告警规则

| 告警名称 | 条件 | 严重程度 |
|----------|------|----------|
| **HighLoginFailureRate** | 失败率 > 10% | P2 |
| **BruteForceDetected** | 同一 IP 5 分钟内 > 10 次失败 | P1 |
| **AnomalousLogin** | 异地登录检测到 | P2 |
| **TokenRevocationSpike** | Token 撤销突增 | P3 |

---

## 4. 仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Auth Overview                     Region: CN-North-1              │
├─────────────────────────────────────────────────────────────────┤
│  Logins/sec   Success Rate   Token Verifications  Token Revokes       │
│  ┌─────────┐ ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ │
│  │  1,234  │ │   98.7%    │ │    12,345    │ │     89       │ │
│  └─────────┘ └─────────────┘ └───────────────┘ └──────────────┘ │
│                                                              │
│  [登录趋势]           [失败原因分布]       [延迟分布]         │
│  ████████████        ▁▁▁▂▂▂▄▄▄▅▅▅▆▆▆           ▁▁▁▁▂▂▃▃▄▄▄           ▁▁▁▁▂▂▂▃▃▄▄           │
└──────────────────────────────────────────────────────────────┘
```
