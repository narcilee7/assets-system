package minihealth

import (
	"context"
	"fmt"
	"net/http"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ===== Health 检查 =====

// Check 健康检查函数
type Check func(ctx context.Context) error

// HealthChecker 健康检查器
type HealthChecker struct {
	mu     sync.RWMutex
	checks map[string]Check
}

func NewHealthChecker() *HealthChecker {
	return &HealthChecker{checks: make(map[string]Check)}
}

// Register 注册检查项
func (h *HealthChecker) Register(name string, check Check) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checks[name] = check
}

// Check 执行所有检查
// 返回整体状态 + 各子项详情
func (h *HealthChecker) Check(ctx context.Context) (status string, details map[string]string) {
	h.mu.RLock()
	checks := make(map[string]Check, len(h.checks))
	for k, v := range h.checks {
		checks[k] = v
	}
	h.mu.RUnlock()

	details = make(map[string]string, len(checks))
	overall := "up"

	for name, check := range checks {
		// 每个检查独立超时
		cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		if err := check(cctx); err != nil {
			details[name] = "down: " + err.Error()
			overall = "down"
		} else {
			details[name] = "up"
		}
		cancel()
	}

	return overall, details
}

// Handler /health 端点
func (h *HealthChecker) Handler(w http.ResponseWriter, r *http.Request) {
	// 支持 ?probe=readiness 或 ?probe=liveness
	probe := r.URL.Query().Get("probe")
	if probe == "" {
		probe = "readiness"
	}

	ctx := r.Context()
	status, details := h.Check(ctx)

	code := http.StatusOK
	if status != "up" {
		code = http.StatusServiceUnavailable
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	// 简单 JSON 输出
	fmt.Fprintf(w, `{"status":"%s","probe":"%s","checks":{`, status, probe)
	first := true
	for k, v := range details {
		if !first {
			w.Write([]byte(","))
		}
		first = false
		fmt.Fprintf(w, `"%s":"%s"`, k, v)
	}
	w.Write([]byte("}}\n"))
}

// ===== Metrics 指标 =====

// MetricType 指标类型
type MetricType string

const (
	TypeCounter   MetricType = "counter"
	TypeGauge     MetricType = "gauge"
	TypeHistogram MetricType = "histogram"
)

// Metric 指标
type Metric struct {
	Name   string
	Help   string
	Type   MetricType
	Labels []string // label names

	// counter/gauge
	value atomic.Int64

	// histogram: bucket 边界
	buckets []float64
	counts  []atomic.Int64 // 每个 bucket 的计数
	sum     atomic.Int64   // 总和（放大 1e6 存整数，避免 float64 atomic 问题）
}

// Registry 指标注册表
type Registry struct {
	mu      sync.RWMutex
	metrics map[string]*Metric
}

func NewRegistry() *Registry {
	return &Registry{metrics: make(map[string]*Metric)}
}

// Counter 创建/获取计数器
func (r *Registry) Counter(name, help string, labels ...string) *Metric {
	return r.getOrCreate(name, help, TypeCounter, nil, labels)
}

// Gauge 创建/获取仪表盘
func (r *Registry) Gauge(name, help string, labels ...string) *Metric {
	return r.getOrCreate(name, help, TypeGauge, nil, labels)
}

// Histogram 创建/获取直方图
func (r *Registry) Histogram(name, help string, buckets []float64, labels ...string) *Metric {
	if len(buckets) == 0 {
		buckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
	}
	return r.getOrCreate(name, help, TypeHistogram, buckets, labels)
}

func (r *Registry) getOrCreate(name, help string, t MetricType, buckets []float64, labels []string) *Metric {
	r.mu.RLock()
	if m, ok := r.metrics[name]; ok {
		r.mu.RUnlock()
		return m
	}
	r.mu.RUnlock()

	r.mu.Lock()
	defer r.mu.Unlock()
	if m, ok := r.metrics[name]; ok {
		return m
	}

	m := &Metric{
		Name:    name,
		Help:    help,
		Type:    t,
		Labels:  labels,
		buckets: buckets,
	}
	if t == TypeHistogram {
		m.counts = make([]atomic.Int64, len(buckets)+1) // 最后一个 bucket 是 +Inf
	}
	r.metrics[name] = m
	return m
}

// Inc 计数器 +1
func (m *Metric) Inc() {
	if m.Type != TypeCounter {
		panic("metric " + m.Name + " is not a counter")
	}
	m.value.Add(1)
}

// Add 计数器 +n
func (m *Metric) Add(n int64) {
	m.value.Add(n)
}

// Set gauge 设置值
func (m *Metric) Set(n int64) {
	if m.Type != TypeGauge {
		panic("metric " + m.Name + " is not a gauge")
	}
	m.value.Store(n)
}

// Observe histogram 记录观察值
func (m *Metric) Observe(v float64) {
	if m.Type != TypeHistogram {
		panic("metric " + m.Name + " is not a histogram")
	}
	// 放大 1e6 存整数
	m.sum.Add(int64(v * 1e6))

	for i, b := range m.buckets {
		if v <= b {
			m.counts[i].Add(1)
			return
		}
	}
	// 超出最大 bucket
	m.counts[len(m.counts)-1].Add(1)
}

// Prometheus 文本格式输出
func (r *Registry) Prometheus() string {
	r.mu.RLock()
	metrics := make([]*Metric, 0, len(r.metrics))
	for _, m := range r.metrics {
		metrics = append(metrics, m)
	}
	r.mu.RUnlock()

	sort.Slice(metrics, func(i, j int) bool {
		return metrics[i].Name < metrics[j].Name
	})

	var b strings.Builder
	for _, m := range metrics {
		fmt.Fprintf(&b, "# HELP %s %s\n", m.Name, m.Help)
		fmt.Fprintf(&b, "# TYPE %s %s\n", m.Name, m.Type)

		switch m.Type {
		case TypeCounter, TypeGauge:
			fmt.Fprintf(&b, "%s %d\n", m.Name, m.value.Load())

		case TypeHistogram:
			// 输出 bucket
			for i, bound := range m.buckets {
				fmt.Fprintf(&b, "%s_bucket{le=\"%g\"} %d\n", m.Name, bound, m.counts[i].Load())
			}
			// +Inf bucket
			fmt.Fprintf(&b, "%s_bucket{le=\"+Inf\"} %d\n", m.Name, m.counts[len(m.counts)-1].Load())
			// sum 和 count
			fmt.Fprintf(&b, "%s_sum %f\n", m.Name, float64(m.sum.Load())/1e6)
			total := int64(0)
			for i := range m.counts {
				total += m.counts[i].Load()
			}
			fmt.Fprintf(&b, "%s_count %d\n", m.Name, total)
		}
		b.WriteByte('\n')
	}

	// 附加 Go runtime 指标
	b.WriteString("# HELP go_goroutines Number of goroutines.\n")
	b.WriteString("# TYPE go_goroutines gauge\n")
	fmt.Fprintf(&b, "go_goroutines %d\n\n", runtime.NumGoroutine())

	return b.String()
}

// Handler /metrics 端点
func (r *Registry) Handler(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.Write([]byte(r.Prometheus()))
}

// ===== Middleware 自动埋点 =====

// Instrument 包装 http.Handler，自动记录请求延迟和计数
func (r *Registry) Instrument(name string, next http.Handler) http.Handler {
	reqCounter := r.Counter(name+"_requests_total", "Total requests", "method", "status")
	latencyHist := r.Histogram(name+"_request_duration_seconds", "Request latency", nil, "method")

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, req)

		duration := time.Since(start).Seconds()
		latencyHist.Observe(duration)

		// 简单版本：不区分 label，直接计数
		// 生产环境用 label 区分 method 和 status
		reqCounter.Inc()
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.WriteHeader(http.StatusOK)
	}
	return rw.ResponseWriter.Write(b)
}