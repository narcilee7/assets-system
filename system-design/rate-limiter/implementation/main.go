package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"ratelimiter/local"
	redispkg "ratelimiter/redis"
)

// CheckRequest 限流检查请求
type CheckRequest struct {
	Resource   string            `json:"resource"`
	Dimensions map[string]string `json:"dimensions"`
}

// CheckResponse 限流检查响应
type CheckResponse struct {
	Allowed   bool   `json:"allowed"`
	Remaining int64  `json:"remaining"`
	ResetAt   int64  `json:"reset_at"`
	Limit     int64  `json:"limit"`
	Window    string `json:"window"`
}

// Server 限流服务
type Server struct {
	store      *RuleStore
	localLimit map[string]LocalLimiter // key -> limiter
	redisTB    *redispkg.TokenBucket
	redisSW    *redispkg.SlidingWindow
	useRedis   bool
}

// LocalLimiter 本地限流器统一接口
type LocalLimiter interface {
	Allow(ctx context.Context) (bool, int64, int64)
	Limit() int64
}

func NewServer(store *RuleStore, useRedis bool, redisClient redis.UniversalClient) *Server {
	s := &Server{
		store:      store,
		localLimit: make(map[string]LocalLimiter),
		useRedis:   useRedis,
	}
	if useRedis {
		s.redisTB = redispkg.NewTokenBucket(redisClient, 100, 10)
		s.redisSW = redispkg.NewSlidingWindow(redisClient, 100, time.Minute)
	}
	return s
}

func (s *Server) getOrCreateLocalLimiter(rule Rule, key string) LocalLimiter {
	if l, ok := s.localLimit[key]; ok {
		return l
	}

	switch rule.Algorithm {
	case TokenBucket:
		capacity := ParseInt64(rule.Config["capacity"])
		if capacity == 0 {
			capacity = 100
		}
		refillRate := ParseInt64(rule.Config["refill_rate"])
		if refillRate == 0 {
			refillRate = 10
		}
		l := local.NewTokenBucketLimiter(capacity, refillRate)
		s.localLimit[key] = l
		return l

	case SlidingWindow:
		limit := ParseInt64(rule.Config["limit"])
		if limit == 0 {
			limit = 100
		}
		window := ParseDuration(rule.Config["window"])
		if window == 0 {
			window = time.Minute
		}
		l := local.NewSlidingWindowLimiter(limit, window)
		s.localLimit[key] = l
		return l

	default:
		// 默认令牌桶
		l := local.NewTokenBucketLimiter(100, 10)
		s.localLimit[key] = l
		return l
	}
}

func (s *Server) handleCheck(w http.ResponseWriter, r *http.Request) {
	var req CheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	rules := s.store.Get(req.Resource)
	if len(rules) == 0 {
		// 无规则，直接放行
		resp := CheckResponse{Allowed: true, Remaining: -1, Limit: -1}
		json.NewEncoder(w).Encode(resp)
		return
	}

	// 取第一条匹配的规则（简化版，生产环境按 priority 排序）
	rule := rules[0]
	key := BuildDimensionKey(rule.Resource, req.Dimensions, rule.DimensionKeys)

	var allowed bool
	var remaining, resetAt int64
	var limit int64

	if s.useRedis {
		ctx := r.Context()
		switch rule.Algorithm {
		case TokenBucket:
			var err error
			allowed, remaining, err = s.redisTB.Allow(ctx, key, 1)
			if err != nil {
				log.Printf("redis token bucket error: %v, fallback to local", err)
				l := s.getOrCreateLocalLimiter(rule, key)
				allowed, remaining, resetAt = l.Allow(ctx)
				limit = l.Limit()
			} else {
				limit = s.redisTB.Capacity()
				resetAt = time.Now().Add(time.Second).Unix()
			}
		case SlidingWindow:
			var err error
			allowed, remaining, err = s.redisSW.Allow(ctx, key)
			if err != nil {
				log.Printf("redis sliding window error: %v, fallback to local", err)
				l := s.getOrCreateLocalLimiter(rule, key)
				allowed, remaining, resetAt = l.Allow(ctx)
				limit = l.Limit()
			} else {
				limit = s.redisSW.Limit()
				resetAt = time.Now().Add(time.Second).Unix()
			}
		default:
			l := s.getOrCreateLocalLimiter(rule, key)
			allowed, remaining, resetAt = l.Allow(ctx)
			limit = l.Limit()
		}
	} else {
		l := s.getOrCreateLocalLimiter(rule, key)
		allowed, remaining, resetAt = l.Allow(r.Context())
		limit = l.Limit()
	}

	resp := CheckResponse{
		Allowed:   allowed,
		Remaining: remaining,
		ResetAt:   resetAt,
		Limit:     limit,
		Window:    "1m",
	}

	w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
	w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
	if !allowed {
		w.WriteHeader(http.StatusTooManyRequests)
	}
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleListRules(w http.ResponseWriter, r *http.Request) {
	resource := r.URL.Query().Get("resource")
	rules := s.store.Get(resource)
	json.NewEncoder(w).Encode(rules)
}

func (s *Server) handleAddRule(w http.ResponseWriter, r *http.Request) {
	var rule Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if rule.ID == "" {
		rule.ID = fmt.Sprintf("rule_%d", time.Now().UnixNano())
	}
	s.store.Add(rule)
	json.NewEncoder(w).Encode(rule)
}

func (s *Server) handleDeleteRule(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/rules/")
	s.store.Delete(id)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]any{
		"mode":       "local",
		"redis":      s.useRedis,
		"local_keys": len(s.localLimit),
	}
	if s.useRedis {
		status["mode"] = "redis"
	}
	json.NewEncoder(w).Encode(status)
}

func main() {
	var (
		addr      = flag.String("addr", ":8080", "监听地址")
		redisAddr = flag.String("redis", "", "Redis 地址（如 127.0.0.1:6379），为空则单机模式")
		redisPass = flag.String("redis-pass", "", "Redis 密码")
	)
	flag.Parse()

	store := NewRuleStore()

	// 预置示例规则
	store.Add(Rule{
		ID:            "rule_api_create_order",
		Resource:      "api:order:create",
		DimensionKeys: []string{"user_id"},
		Algorithm:     TokenBucket,
		Config: map[string]any{
			"capacity":    10,
			"refill_rate": 2,
		},
		Enabled: true,
	})

	store.Add(Rule{
		ID:            "rule_api_submit_pay",
		Resource:      "api:pay:submit",
		DimensionKeys: []string{"user_id"},
		Algorithm:     SlidingWindow,
		Config: map[string]any{
			"limit":  5,
			"window": "1m",
		},
		Enabled: true,
	})

	useRedis := *redisAddr != ""
	var redisClient redis.UniversalClient
	if useRedis {
		redisClient = redis.NewClient(&redis.Options{
			Addr:     *redisAddr,
			Password: *redisPass,
			DB:       0,
		})
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := redisClient.Ping(ctx).Err(); err != nil {
			log.Fatalf("redis ping failed: %v", err)
		}
		log.Println("redis connected")
	}

	server := NewServer(store, useRedis, redisClient)

	mux := http.NewServeMux()
	mux.HandleFunc("/check", server.handleCheck)
	mux.HandleFunc("/rules", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			server.handleListRules(w, r)
		case http.MethodPost:
			server.handleAddRule(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/rules/", server.handleDeleteRule)
	mux.HandleFunc("/status", server.handleStatus)

	log.Printf("rate limiter server starting on %s (redis=%v)", *addr, useRedis)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
