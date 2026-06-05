# TLS Handshake Walkthrough

## 目标

掌握 TLS 1.2 和 TLS 1.3 的握手过程，理解密钥交换、数字证书、完整前向保密（PFS），以及为什么 TLS 1.3 比 1.2 快。

## 场景

- HTTPS 延迟高，分析 TLS 握手开销
- 证书链验证失败，定位根因
- TLS 1.3 0-RTT 的安全考虑
- ECDHE vs RSA 握手性能差异

## TLS 1.2

### RSA 握手（传统，密钥传输方式）

```
Client                              Server
  |                                    |
  |  -- ClientHello (TLS 版本, 加密套件, 随机数) -->  |
  |                                    |
  |  <-- ServerHello (选中的加密套件, 随机数)      |
  |  <-- Certificate (服务器证书链)                |
  |  <-- ServerHelloDone                           |
  |                                    |
  |  -- PreMasterSecret (用服务端公钥加密) -->  |
  |  -- ChangeCipherSpec -->                      |
  |  -- Finished (握手摘要) -->                   |
  |                                    |
  |  <-- ChangeCipherSpec                        |
  |  <-- Finished (握手摘要)                    |
  |                                    |
  |     使用 PreMasterSecret 生成会话密钥        |
  |                                    |
  ===== 应用层数据加密传输 =====
```

**RSA 握手的问题**：
- 如果攻击者拿到了服务端的私钥，可以解密所有历史会话（因为 PreMasterSecret 被服务端私钥加密存储）
- **不具备前向保密（Forward Secrecy）**

### ECDHE 握手（RSA + 密钥协商）

```
Client                              Server
  |                                    |
  |  -- ClientHello (TLS 版本, 加密套件, 随机数) -->  |
  |  -- SupportedVersions (TLS 1.3) -->             |  如果客户端支持 1.3
  |  -- key_share (EC Diffie-Hellman 公钥) -->      |
  |  -- signature_algorithms -->                   |
  |                                    |
  |  <-- ServerHello (版本, 加密套件, 随机数)      |
  |  <-- key_share (EC DH 公钥)                   |
  |  <-- certificate (证书 + 签名)                |
  |  <-- certificate_verify (签名证明有私钥)       |
  |  <-- finished (握手摘要)                      |
  |                                    |
  |  用 DH 公钥计算出 PreMasterSecret             |
  |  双方得到相同的会话密钥                       |
  |  不需要传输密钥                               |
  |                                    |
  ===== 应用层数据加密传输 =====
```

**ECDHE 的优势**：
- 服务器私钥只用于签名（不加密密钥），攻击者拿到私钥也无法解密历史会话
- **具备前向保密（Forward Secrecy）**

### TLS 1.2 完整握手时序

```
RTT 0: 客户端 -> 服务端: ClientHello
RTT 1: 客户端 <- 服务端: ServerHello + Certificate + ServerHelloDone
RTT 2: 客户端 -> 服务端: PreMasterSecret + ChangeCipherSpec + Finished
       客户端 <- 服务端: ChangeCipherSpec + Finished
       
总耗时：2 RTT 才能开始传输数据
```

## TLS 1.3

### TLS 1.3 的改进

1. **简化握手**：从 2 RTT -> 1 RTT（或 0 RTT）
2. **移除不安全特性**：RC4、3DES、MD5、SHA-1、AES-CBC、静态 RSA 密钥传输
3. **强制前向保密**：所有密钥协商必须使用 ECDHE
4. **加密握手**：Certificate 阶段也被加密（0-RTT 除外）

### 1-RTT 握手

```
Client                              Server
  |                                    |
  |  -- ClientHello                    |
  |     key_share (EC DH 公钥)         |  关键改进：key_share 在第一个包就发
  |     signature_algorithms           |
  |     supported_versions             |
  |  -->                               |
  |                                    |
  |  <-- ServerHello                   |
  |     key_share (EC DH 公钥)         |  服务端也回 key_share
  |     {EncryptedExtensions}          |  应用层数据从这里开始加密
  |     {Certificate}                  |
  |     {CertificateVerify}            |
  |     {Finished}                    |
  |                                    |
  |  用双方的 DH 公钥计算出主密钥       |
  |  客户端立即可以发送加密数据        |
  |                                    |
  ===== 应用层数据加密传输 =====
```

**关键变化**：
- ECDHE 公钥在 ClientHello 中就发送（key_share），不需要等 ServerHello
- 服务端收到 ClientHello 后直接计算出密钥，立即发送加密数据
- **总耗时：1 RTT**

### 0-RTT 握手

```
Client                              Server
  |                                    |
  |  -- ClientHello                    |
  |     key_share (EC DH 公钥)          |
  |     early_data (加密的应用数据)     |  第一个包就带数据！
  |     psks (Pre-Shared Keys)         |  之前建立的 PSK
  |  -->                               |
  |                                    |
  |  <-- ServerHello                   |
  |     key_share                      |
  |     {EncryptedExtensions}          |
  |     {Finished}                     |
  |                                    |
  ===== 应用层数据继续传输 =====
```

**0-RTT 的条件**：
- 客户端之前和服务器建立过 TLS 连接
- 服务器返回了 `session_ticket`（PSK - Pre-Shared Key）
- 客户端在新的连接中使用 PSK 直接计算出主密钥，不需要等待 ServerHello

**0-RTT 的安全问题**：
- **重放攻击**：攻击者可以截获并重放 0-RTT 消息
- 解决：服务器对 0-RTT 数据做幂等性检查，或者只用 GET 请求

### TLS 1.3 握手时序对比

```
TLS 1.2 ECDHE:
  RTT 0: ClientHello
  RTT 1: ServerHello + Certificate + ServerHelloDone
  RTT 2: ClientKeyExchange + ChangeCipherSpec + Finished
         ChangeCipherSpec + Finished
  = 2 RTT

TLS 1.3 1-RTT:
  RTT 0: ClientHello + key_share
  RTT 1: ServerHello + key_share + EncryptedExtensions + Finished
  = 1 RTT

TLS 1.3 0-RTT:
  RTT 0: ClientHello + key_share + early_data (第一个包带数据)
  = 0 RTT (立即传输)
```

## 证书链验证

### 证书链结构

```
根证书 (Root CA)：
  - 自签名（自己签自己）
  - 操作系统/浏览器内置
  - 不在 TLS 证书链中传输

中间证书 (Intermediate CA)：
  - Root CA 签发
  - 服务器发送给客户端
  - 可能有多个中间证书

服务器证书 (Leaf Certificate)：
  - 由中间证书签发
  - 包含服务器域名、公钥、有效期
```

### 证书验证过程

```bash
# 查看证书链
openssl s_client -connect example.com:443 -showcerts

# 手动验证证书链
openssl verify -CAfile /path/to/root.crt /path/to/server.crt

# 查看证书详情
openssl x509 -in /path/to/cert.pem -text -noout
# 关键字段：
#   Subject: CN=example.com
#   Issuer:  CN=Let's Encrypt Authority X3
#   Validity: Not Before... Not After...
#   Subject Alternative Name: DNS:example.com, DNS:www.example.com
#   Public Key: RSA 2048 bits
#   Signature Algorithm: SHA256withRSA
```

### 证书验证失败的原因

1. **域名不匹配**：`Subject Alternative Name` 不包含请求的域名
2. **证书过期**：`Not After` 已过
3. **证书链不完整**：服务器没发中间证书（需要配置 `ssl_certificate_chain`）
4. **自签名证书**：不在系统信任库中
5. **中间证书过期**：链中任何证书过期都会导致验证失败
6. **CRL/OCSP 问题**：证书被吊销但验证方没检查

```bash
# 检查 CRL
openssl x509 -in cert.pem -noout -text | grep -A 5 "CRL"

# 检查 OCSP
openssl ocsp -issuer chain.crt -cert cert.pem -url http://ocsp.example.com

# 检查证书是否在浏览器中可信
# https://www.ssllabs.com/ssltest/analyze.html?d=example.com
```

## 加密套件

### TLS 1.2 加密套件

```
TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
  - ECDHE: 密钥交换（提供前向保密）
  - RSA: 服务器证书类型
  - AES-128-GCM: 对称加密算法（AES-128，Galois/Counter Mode）
  - SHA256: MAC / PRF

TLS_RSA_WITH_AES_256_CBC_SHA
  - RSA: 密钥传输（无前向保密）
  - AES-256-CBC: 加密
  - SHA: MAC
  - 问题：RSA 密钥传输如果私钥泄露，历史全部可解密
```

### TLS 1.3 加密套件

```
TLS_AES_128_GCM_SHA256
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
TLS_AES_128_CCM_SHA256

- 密钥交换算法独立（ECDHE）
- 加密套件只描述对称加密和 MAC
- 1.3 的 `TLS_AES_128_GCM_SHA256` ≈ TLS 1.2 的 `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`
```

### 查看支持的加密套件

```bash
# 客户端支持
openssl s_client -tls1_2 -cipher ECDHE-RSA-AES128-GCM-SHA256 -connect example.com:443

# 查看系统支持
openssl ciphers -v 'ECDHE+AESGCM:ECDHE+CHACHA20'

# TLS 1.3 支持
openssl s_client -tls1_3 -connect example.com:443
```

## 抓包分析

### TLS 1.2 握手抓包

```bash
# 抓 TLS 握手
tcpdump -i eth0 -w tls12.pcap 'tcp port 443 and tcp[tcpflags] & (tcp-syn|tcp-ack) != 0'

# Wireshark 分析
# 过滤: tls.handshake.type == 1 (ClientHello)
# 过滤: tls.handshake.type == 2 (ServerHello)
# 过滤: tls.handshake.type == 11 (Certificate)
# 过滤: tls.handshake.type == 16 (ClientKeyExchange)
```

### TLS 1.3 握手抓包

```bash
# TLS 1.3 的 ClientHello 在 TCP 包之后立即发送
# 不再有 ServerHello 之前的明文交换

# Wireshark 需要配置 RSA 或者 ECDHE 密钥日志才能解密
# 导出密钥：Wireshark -> Edit -> Preferences -> Protocols -> TLS -> RSA keys
```

### 常用诊断

```bash
# 测试 TLS 版本
openssl s_client -tls1_2 -connect example.com:443
openssl s_client -tls1_3 -connect example.com:443

# 测试证书链完整性
openssl s_client -showcerts -connect example.com:443 </dev/null | grep -A 2 "Certificate chain"

# 测试支持的加密套件
openssl s_client -connect example.com:443 -cipher ECDHE-RSA-AES128-GCM-SHA256

# 检查 OCSP stapling
openssl s_client -status -connect example.com:443 </dev/null | grep -A 5 "OCSP Response"

# 检查 SNI（Server Name Indication）
openssl s_client -connect example.com:443 -servername example.com
```

## 性能优化

### 证书链优化

```nginx
# Nginx 配置：发送完整证书链
ssl_certificate /path/to/fullchain.pem;  # 包含服务器证书 + 中间证书
ssl_certificate_key /path/to/privkey.pem;
```

### Session Resumption

```bash
# TLS Session Ticket（无状态恢复）
# 服务端在 TLS 握手结束时发送加密的 session ticket
# 客户端下次连接时发送 ticket，恢复会话

# 客户端配置
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1h;

# 查看 session 复用
curl -v https://example.com 2>&1 | grep "SSL session"
```

### OCSP Stapling

```nginx
# 服务端预先获取 OCSP 响应，在 TLS 握手时发送给客户端
# 客户端不需要额外查询

ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8;
```

## L2：源码锚定与边界陷阱

### OpenSSL / BoringSSL 关键函数

| 阶段 | 函数 | 说明 |
|---|---|---|
| ClientHello | `ssl3_send_client_hello` | ssl/statem/statem_clnt.c：发送版本、加密套件、key_share |
| ServerHello | `tls_process_server_hello` | ssl/statem/statem_clnt.c：解析选中版本和密钥交换参数 |
| 密钥推导 | `tls13_generate_handshake_secret` | ssl/tls13_enc.c：HKDF 导出 handshake traffic secret |
| 证书验证 | `X509_verify_cert` | crypto/x509/x509_vfy.c：证书链验证 |
| 0-RTT | `tls13_write_early_data` | ssl/record/rec_layer_s3.c：发送 early_data |

### 证书链不完整陷阱

```
服务端只配置 leaf.crt（服务器证书）
  └── 客户端没有中间证书
      └── 无法建立信任链到 Root CA
      └── 报错：certificate verify failed

正确配置（Nginx）：
  ssl_certificate /path/to/fullchain.pem;  # leaf + intermediate
  ssl_certificate_key /path/to/privkey.pem;

检查命令：
  openssl s_client -connect example.com:443 -showcerts
  # 如果只看到 1 张证书，说明链不完整
```

### SNI（Server Name Indication）

```
TLS 1.2 之前：
  - 一个 IP 只能对应一个证书（因为握手时还没发 Host header）

TLS 1.2+ SNI：
  - ClientHello 的 extensions 中包含 server_name
  - 服务端根据 SNI 选择对应的证书

陷阱：
  - 如果客户端（如旧版 Java 7）不支持 SNI，服务端返回默认证书
  - 默认证书域名不匹配 -> 证书验证失败
```

### 边界陷阱

1. **TLS 1.3 的 middlebox 兼容问题**：
   TLS 1.3 的 ClientHello 在 wire 上看起来像 TLS 1.2（版本号伪装），但有些企业防火墙/代理会篡改握手包，导致握手失败。Chrome/Firefox 都有 fallback 到 TLS 1.2 的机制。

2. **Session Ticket 密钥轮换**：
   服务端用 ticket_key 加密 session ticket，如果 ticket_key 泄露，攻击者可解密 0-RTT 数据。生产环境应定期轮换 ticket_key。

3. **证书过期监控盲区**：
   只监控 leaf cert 过期不够，中间证书也可能过期（如 2021 年 DST Root CA X3 过期导致 Let's Encrypt 证书链问题）。应监控整条链的有效期。

## L3：可运行实验

见 `impl/tls_lab/`：

```bash
cd systems-engineering/computer-networking/impl/tls_lab
python3 tls_client.py cloudflare.com
```

脚本输出：
- 协商的 TLS 版本（如 TLSv1.3）
- 加密套件（如 TLS_AES_256_GCM_SHA384）
- 证书链信息（CN、SAN、Issuer、有效期）
- 对比 TLS 1.2 与 TLS 1.3 的握手结果

## 核心追问

1. **TLS 1.2 和 1.3 的核心区别？** 1.3 把 key_share 提前到第一个包，省掉 1 RTT；移除 RSA 密钥传输，强制前向保密
2. **什么是前向保密（Forward Secrecy）？** 即使服务端的私钥泄露，攻击者也无法解密历史会话，因为密钥是临时协商的
3. **ECDHE 握手为什么比 RSA 快？** RSA 需要等待服务端 Certificate 才能发 KeyExchange（2 RTT）；ECDHE 的 key_share 在第一个包就发，1 RTT
4. **0-RTT 为什么不能用于 POST 请求？** 0-RTT 数据可能被重放，POST 是非幂等的，重放会导致重复写入
5. **证书链验证失败最常见的原因？** 服务端没配置完整链（只有 leaf cert，缺少中间证书）；客户端需要中间证书才能验证 leaf

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| TCP deep dive | L2+L3 | done |
| HTTP versions comparison | L2+L3 | done |
| TLS handshake walkthrough | **L2+L3** | **done** |
| network troubleshooting playbook | L1 | todo |