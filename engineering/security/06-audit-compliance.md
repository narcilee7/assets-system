# 审计合规

## 1. 安全日志

```
日志记录原则：
├── 记录什么：
│   ├── 认证事件：登录、登出、密码修改、MFA 验证
│   ├── 授权事件：权限变更、访问被拒绝
│   ├── 数据变更：创建、修改、删除敏感数据
│   ├── 管理操作：配置变更、用户管理
│   └── 异常事件：错误、异常、攻击尝试
├── 不记录什么：
│   ├── 密码、Token、密钥
│   ├── 完整的信用卡号
│   ├── 个人隐私数据（身份证号、手机号）
│   └── 大量二进制数据
├── 日志格式：
│   ├── 结构化日志（JSON）
│   ├── 包含：时间戳、级别、用户、IP、操作、结果、请求 ID
│   └── 统一时钟（NTP）
└── 日志保护：
    ├── 不可篡改（WORM 存储）
    ├── 访问控制（最小权限）
    └── 定期归档
```

```json
// 安全日志示例
{
  "timestamp": "2024-06-08T12:00:00.000Z",
  "level": "INFO",
  "event_type": "auth.login",
  "request_id": "req-abc123",
  "user_id": "user-456",
  "client_ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "action": "login",
  "resource": "/api/auth/login",
  "method": "POST",
  "result": "success",
  "mfa_used": true,
  "session_id": "sess-xyz789",
  "geo_location": {
    "country": "CN",
    "city": "Beijing"
  },
  "risk_score": 0.1
}
```

```python
# 结构化安全日志（Python）
import structlog
import logging

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# 记录安全事件
logger.info(
    "auth.login",
    user_id="user-456",
    client_ip="192.168.1.100",
    result="success",
    mfa_used=True
)

# 记录异常访问
logger.warning(
    "auth.access_denied",
    user_id="user-456",
    resource="/api/admin",
    reason="insufficient_privileges"
)
```

## 2. 合规框架

```
主要合规标准：

GDPR（欧盟）
├── 数据最小化
├── 目的限制
├── 存储期限限制
├── 数据主体权利（访问、更正、删除、可携带）
├── 数据处理记录（DPIA）
├── 数据泄露通知（72 小时内）
└── 罚款：最高 2000 万欧元或全球营业额 4%

PCI DSS（支付卡行业）
├── 安全网络和系统
├── 持卡人数据保护
├── 漏洞管理
├── 访问控制
├── 网络监控和测试
└── 信息安全政策

SOC 2（美国）
├── 安全性（Security）
├── 可用性（Availability）
├── 处理完整性（Processing Integrity）
├── 保密性（Confidentiality）
└── 隐私性（Privacy）

等保 2.0（中国）
├── 安全物理环境
├── 安全通信网络
├── 安全区域边界
├── 安全计算环境
├── 安全管理中心
└── 等级：1-5 级
```

## 3. 渗透测试与漏洞管理

```
渗透测试类型：
├── 黑盒测试：无内部信息，模拟外部攻击者
├── 灰盒测试：部分内部信息，模拟有访问权限的攻击者
├── 白盒测试：完整源码和架构，最全面
└── 紫盒测试：红队（攻击）+ 蓝队（防御）协作

漏洞管理流程：
├── 发现：
│   ├── 自动化扫描：Nessus、OpenVAS、Burp Suite
│   ├── 代码审计：SonarQube、Semgrep
│   └── 渗透测试：手工测试
├── 评估：
│   ├── CVSS 评分（0-10）
│   ├── 业务影响分析
│   └── 可利用性评估
├── 修复：
│   ├── P0（Critical）：24 小时内
│   ├── P1（High）：7 天内
│   ├── P2（Medium）：30 天内
│   └── P3（Low）：90 天内
├── 验证：
│   └── 复测确认修复
└── 报告：
    └── 漏洞台账、趋势分析

CVSS 3.1 评分维度：
├── 基础指标：攻击向量、复杂度、所需权限、用户交互
├── 范围：是否影响其他组件
├── 影响：机密性、完整性、可用性
└── 时间指标：利用代码成熟度、修复级别、报告置信度
```

```bash
# 常用安全扫描工具

# 依赖漏洞扫描
npm audit
snyk test
pip-audit

# 容器扫描
trivy image myapp:latest
grype myapp:latest

# 基础设施扫描
tfsec  # Terraform
checkov  # 多云

# Web 应用扫描
zap-baseline.py -t https://example.com
nikto -h https://example.com

# 密钥扫描
git-secrets --scan-history
trilio  # GitLeaks
gitleaks detect
```
