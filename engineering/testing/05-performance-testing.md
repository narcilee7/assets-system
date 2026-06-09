# 性能测试

## 1. 性能测试类型

```
性能测试分类

负载测试（Load Testing）
├── 目标：验证系统在预期负载下的表现
├── 场景：正常流量、峰值流量
├── 指标：吞吐量、延迟、错误率、资源使用
└── 示例：1000 并发用户，持续 10 分钟

压力测试（Stress Testing）
├── 目标：找到系统崩溃点
├── 场景：超出预期负载，逐步增加直到失败
├── 指标：最大承载量、恢复行为
└── 示例：从 1000 并发逐步增加到 10000

Soak 测试（耐久测试）
├── 目标：发现长时间运行问题
├── 场景：持续数小时/天的中等负载
├── 指标：内存泄漏、连接泄漏、性能衰减
└── 示例：500 并发用户，持续 24 小时

峰值测试（Spike Testing）
├── 目标：验证突发流量处理能力
├── 场景：瞬间大量请求
├── 指标：响应时间、错误率、恢复速度
└── 示例：0 → 10000 并发，持续 1 分钟

基准测试（Benchmark）
├── 目标：测量代码性能，优化前后对比
├── 场景：函数级、API 级
├── 指标：ops/sec、ns/op、内存分配
└── 工具：Go testing.B、JMH、Benchmark.js
```

## 2. 负载测试工具

```javascript
// k6 负载测试（推荐）
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // 缓慢加压
    { duration: '5m', target: 100 },   // 稳定负载
    { duration: '2m', target: 200 },   // 增加负载
    { duration: '5m', target: 200 },   // 稳定负载
    { duration: '2m', target: 0 },     // 减压
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // P95 < 200ms
    http_req_failed: ['rate<0.01'],     // 错误率 < 1%
  },
};

export default function () {
  const res = http.get('https://api.example.com/users');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

```bash
# 运行 k6
k6 run load-test.js
k6 run --out influxdb=http://localhost:8086/k6 load-test.js

# k6 Cloud
k6 cloud load-test.js
```

```xml
<!-- JMeter（XML 配置）-->
<jmeterTestPlan>
  <ThreadGroup testname="Load Test">
    <elementProp name="ThreadGroup.arguments">
      <stringProp name="ThreadGroup.num_threads">100</stringProp>
      <stringProp name="ThreadGroup.ramp_time">60</stringProp>
      <stringProp name="ThreadGroup.duration">300</stringProp>
    </elementProp>
    <HTTPSamplerProxy testname="Get Users">
      <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
      <stringProp name="HTTPSampler.path">/users</stringProp>
      <stringProp name="HTTPSampler.method">GET</stringProp>
    </HTTPSamplerProxy>
  </ThreadGroup>
</jmeterTestPlan>
```

## 3. 基准测试

```go
// Go Benchmark
func BenchmarkFibonacci(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Fibonacci(20)
    }
}

// 内存分析
func BenchmarkAlloc(b *testing.B) {
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        processLargeData()
    }
}

// 并行基准测试
func BenchmarkParallel(b *testing.B) {
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            doWork()
        }
    })
}
```

```bash
# 运行
go test -bench=. -benchmem

# 对比优化前后
# 先保存旧结果
go test -bench=BenchmarkFibonacci -count=5 > old.txt
# 优化后
go test -bench=BenchmarkFibonacci -count=5 > new.txt
# 对比
benchstat old.txt new.txt
```

```javascript
// Node.js Benchmark.js
const Benchmark = require('benchmark');

const suite = new Benchmark.Suite();

suite
  .add('regex', () => {
    /o/.test('Hello World!');
  })
  .add('indexOf', () => {
    'Hello World!'.indexOf('o') > -1;
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run();
```
