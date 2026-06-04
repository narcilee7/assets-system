# Network Troubleshooting Playbook

## 目标

训练网络问题的快速定位能力：从物理链路到应用层，逐层诊断丢包、延迟、连接失败。

## 场景

- 服务访问外部 API 超时
- 客户端连接被拒绝（RST）
- DNS 解析慢或失败
- 网络延迟高，P99 延迟异常
- 连接数耗尽（too many open connections）

## 诊断路径

### 0. 快速概览（30 秒）

```bash
# 1. 连通性测试
ping -c 3 8.8.8.8                    # 丢包率、延迟
ping -c 3 api.example.com            # DNS 解析 + 连通性

# 2. DNS 解析
dig +short api.example.com           # A record
dig +trace api.example.com           # 递归解析路径
nslookup api.example.com             # 简单查询

# 3. 端口连通性
nc -zv api.example.com 443          # 测试 TCP 端口
timeout 3 bash -c 'cat < /dev/tcp/api.example.com/443'  # 简单测试

# 4. 路由追踪
traceroute -m 20 api.example.com    # UDP traceroute
traceroute -I api.example.com        # ICMP traceroute
mtr -rwc 10 api.example.com          # 实时 traceroute（推荐）

# 5. 连接状态概览
ss -s
ss -tunapl | head -20
```

### 1. 连通性：ping / mtr

```bash
# ping 看丢包和延迟
ping -c 20 api.example.com
# 关键指标：rtt min/avg/max/mdev（延迟波动）

# mtr 看逐跳延迟和丢包（实时）
mtr -rwc 20 api.example.com
# 每行是一个 hop，显示该跳的：
#   Loss%   Snt   Last   Avg  Best  Wrst  StDev
#   0.0%    20    1.2    1.5   0.9   3.2   0.5

# 关键看：
# - 哪一跳开始丢包（网络问题 vs 目的地问题）
# - 延迟突然增加的跳（拥塞点）
# - 100% 丢包（防火墙丢弃 or 目的地不可达）
```

### 2. DNS 诊断

```bash
# 基本 DNS 查询
dig +short api.example.com
dig +noall +answer api.example.com   # 完整输出

# 查看 DNS 服务器
dig +trace api.example.com           # 递归追踪

# 对比不同 DNS 服务器
dig @8.8.8.8 api.example.com
dig @1.1.1.1 api.example.com
dig @223.5.5.5 api.example.com

# 反向查询
dig -x 1.2.3.4

# 查看 TTL
dig +noall +answer +ttlid api.example.com

# 常见 DNS 问题：
# - TTL 很长但 IP 变了（新 IP 不生效）
# - 负载均衡多个 IP 但只解析了一个
# - DNS 缓存投毒
```

### 3. 端口和连接测试

```bash
# TCP 端口检测
nc -zv api.example.com 443
# 成功：Connection to api.example.com 443 port [tcp/https] succeeded!
# 失败：No route to host / Connection refused / timeout

# 测试 HTTP/HTTPS
curl -v https://api.example.com 2>&1 | head -30
curl -I https://api.example.com  # 只看 header

# 测试 TLS
openssl s_client -connect api.example.com:443 -servername api.example.com
# 看证书链、支持的 TLS 版本、加密套件

# 查看本地端口占用
lsof -i :8080
netstat -tunapl | grep :8080

# 查看本地 IP 和路由
ip addr show
ip route show
```

### 4. 抓包分析

```bash
# 抓 SYN 看连接建立
tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0 and tcp[tcpflags] & tcp-ack == 0' -nn

# 抓完整 TCP 流
tcpdump -i eth0 'tcp port 8080' -nn -A | head -50

# 抓 HTTP 请求/响应
tcpdump -i eth0 'tcp port 80 and (tcp[tcpflags] & tcp-ack != 0)' -A | head -30

# 抓 DNS
tcpdump -i eth0 'udp port 53' -A | head -30

# 抓 ICMP
tcpdump -i eth0 'icmp' -nn

# 保存到文件（后续用 Wireshark 分析）
tcpdump -i eth0 'tcp port 8080' -w capture.pcap

# 读取 pcap 文件
tcpdump -r capture.pcap 'tcp[tcpflags] & tcp-syn != 0' -nn

# 过滤单个 IP
tcpdump -i eth0 'host 10.0.0.1 and tcp port 443' -nn

# 过滤特定端口
tcpdump -i eth0 'port 8080 or port 8443' -nn
```

### 5. TCP 连接状态

```bash
# 统计所有连接状态
ss -s

# 按状态分组
ss -ant | awk '{print $1}' | sort | uniq -c | sort -rn

# 看 TIME_WAIT（多说明连接关闭太快）
ss -ant state time-wait | head -10

# 看 SYN_SENT / SYN_RECV（高说明连接建立失败）
ss -ant state syn-sent
ss -ant state syn-recv

# 看 Orphan（进程已退出但 socket 没 close）
ss -tupl | grep -v "pid"

# 看 Listen 队列
ss -ltn | grep "Listen"

# 查看具体端口的连接
ss -tunapl sport = :8080
ss -tunapl dport = :8080

# 看 TCP 重传
cat /proc/net/snmp | grep -E "RetransSegs|OutSegs"
# RetransSegs / OutSegs > 1% 说明有网络问题
```

### 6. 丢包和错误

```bash
# 网卡层面
cat /proc/net/dev
# iface: rbytes   rpackets rerors rfifo rframe rdrop rcoll
#        tbytes   tpackets terror tfifo tframe tdrop tcoll

# 关注：drop（丢包）、fifo（缓冲区溢出）、coll（冲突）

# 看错误和丢包趋势
watch -n 1 'cat /proc/net/dev | grep eth0'

# TCP 丢包
cat /proc/net/snmp | grep -E "RetransSegs|OutSegs|Twem"

# ICMP 丢包
cat /proc/net/snmp | grep -E "IcmpMsg"

# 连接状态转换
cat /proc/net/sockstat
```

### 7. 网络延迟

```bash
# TCP RTT
ss -i
# rtt: 2.5/5 (avg/dev)
# pacing_rate: 网络吞吐量上限

# UDP 延迟测试（配合 iperf3）
iperf3 -s    # 服务端
iperf3 -c <server_ip> -R  # 客户端下载测试
iperf3 -c <server_ip>     # 客户端上传测试

# 看当前网络配置
ip -s link show eth0
ethtool -S eth0

# 看网卡协商速度和双工
ethtool eth0
# Speed: 1000Mb/s
# Duplex: Full
# 如果 Duplex: Half 说明有问题
```

### 8. MTU 和分片

```bash
# 查看 MTU
ip link | grep mtu
# default via 10.0.0.1 dev eth0 proto dhcp src 10.0.0.100 mtu 1500

# 测试 MTU（Path MTU Discovery）
ping -M do -s 1400 api.example.com  # 不分片，大包测试
ping -M do -s 1500 api.example.com  # 如果丢包，说明 MTU 问题

# 常见问题：
# - VPN 隧道 MTU 较小，分片导致性能下降
# - VPN 隧道直接丢弃 ICMP，需要手动调低 MTU
# - MSS Clamping：TCP 包超过 MTU 自动分片

# 查看 TCP MSS
ss -i | grep mss
```

### 9. TLS 诊断

```bash
# TLS 版本和加密套件
openssl s_client -connect api.example.com:443 -tls1_2
openssl s_client -connect api.example.com:443 -tls1_3

# TLS 握手延迟
curl -w "DNS: %{time_namelookup}s, Connect: %{time_connect}s, SSL: %{time_appconnect}s, Total: %{time_total}s\n" -o /dev/null -s https://api.example.com

# 证书信息
openssl s_client -connect api.example.com:443 -showcerts </dev/null | grep -E "subject|issuer|not before|not after"

# 检查证书链
openssl s_client -connect api.example.com:443 -showcerts </dev/null | grep "Certificate chain"

# SNI（Server Name Indication）
openssl s_client -connect api.example.com:443 -servername api.example.com
```

## 常见故障对照表

| 现象 | 快速命令 | 根因 | 解决方案 |
|---|---|---|---|
| ping 不通 | traceroute | 路由问题/防火墙 | 查 traceroute 哪跳断了 |
| DNS 解析慢 | dig +trace | DNS 服务器慢/递归链长 | 换 DNS (8.8.8.8/1.1.1.1) |
| 连接拒绝 | nc -zv / telnet | 服务没起/端口错/防火墙 | 确认服务端口，检查防火墙 |
| 连接超时 | curl -v / tcpdump | 网络不通/超时设置短 | 路由/防火墙/mtu 问题 |
| TIME_WAIT 过多 | ss -ant | 频繁建连/关闭太快 | tcp_tw_reuse, keepalive |
| SYN_SENT 过多 | ss -ant | 服务端不响应 SYN | 服务端 backlog/防火墙 |
| 延迟高但没丢包 | mtr / ss -i | 链路拥塞/mtu 分片 | 优化路由/调大 MTU |
| TLS 握手慢 | curl -w | 证书链/OCSP/加密套件 | 优化证书链/启用 OCSP stapling |
| RST 断开 | tcpdump | 服务端重启/超时/防火墙 | 检查对端状态 |

## 核心追问

1. **mtr 和 traceroute 的区别？** mtr 实时显示每跳统计（丢包%、延迟），traceroute 只显示跳但不显示实时统计
2. **TIME_WAIT 过多怎么处理？** 开启 `tcp_tw_reuse=1`、调大本地端口范围、用连接池复用连接
3. **ping 通但 TCP 连不上说明什么？** 可能是防火墙只放行 ICMP 不放行 TCP，或者服务没监听该端口
4. **MTU 导致的丢包有什么特征？** 大包丢小包不丢，traceroute 正常但实际访问慢，需要 ping -M do 测试
5. **TCP 重传率高但 mtr 显示没丢包？** 可能是应用层丢包（接收方 buffer 满、滑动窗口为 0）导致的隐形丢包

## 复杂度

- 时间复杂度：O(n) — 每步命令 O(1)
- 空间复杂度：O(1) — 只读，不改变系统

## 工程迁移

配合监控（Prometheus node_exporter 的 `node_network_*` 指标）建立网络基线。在告警触发时用 playbook 定位。

## 状态

| 资产 | 状态 |
|---|---|
| TCP deep dive | done |
| HTTP versions comparison | done |
| TLS handshake walkthrough | done |
| network troubleshooting playbook | done |