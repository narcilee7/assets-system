package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Result 限流判断结果
type Result struct {
	Allowed   bool  `json:"allowed"`
	Remaining int64 `json:"remaining"`
	ResetAt   int64 `json:"reset_at"`
	Limit     int64 `json:"limit"`
}

// Limiter 限流器接口
type Limiter interface {
	Allow(ctx context.Context, resource string, dimensions map[string]string) (*Result, error)
}

// Algorithm 限流算法类型
type Algorithm string

const (
	TokenBucket   Algorithm = "token_bucket"
	SlidingWindow Algorithm = "sliding_window"
)

// Rule 限流规则
type Rule struct {
	ID            string            `json:"id"`
	Resource      string            `json:"resource"`
	DimensionKeys []string          `json:"dimension_keys"`
	Algorithm     Algorithm         `json:"algorithm"`
	Config        map[string]any    `json:"config"`
	Priority      int               `json:"priority"`
	Enabled       bool              `json:"enabled"`
}

// RuleStore 规则存储（内存实现，生产环境用配置中心）
type RuleStore struct {
	mu     sync.RWMutex
	rules  map[string][]Rule // resource -> rules
	byID   map[string]Rule
}

func NewRuleStore() *RuleStore {
	return &RuleStore{
		rules: make(map[string][]Rule),
		byID:  make(map[string]Rule),
	}
}

func (s *RuleStore) Add(rule Rule) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.byID[rule.ID] = rule
	if !rule.Enabled {
		return
	}
	s.rules[rule.Resource] = append(s.rules[rule.Resource], rule)
}

func (s *RuleStore) Get(resource string) []Rule {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rules[resource]
}

func (s *RuleStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rule, ok := s.byID[id]
	if !ok {
		return
	}
	delete(s.byID, id)
	list := s.rules[rule.Resource]
	filtered := make([]Rule, 0, len(list))
	for _, r := range list {
		if r.ID != id {
			filtered = append(filtered, r)
		}
	}
	s.rules[rule.Resource] = filtered
}

// BuildDimensionKey 根据维度生成 key
func BuildDimensionKey(resource string, dimensions map[string]string, keys []string) string {
	key := resource
	for _, k := range keys {
		if v, ok := dimensions[k]; ok {
			key += fmt.Sprintf(":%s=%s", k, v)
		}
	}
	return key
}

// ParseDuration 解析配置中的时间字符串
func ParseDuration(v any) time.Duration {
	switch d := v.(type) {
	case string:
		dur, _ := time.ParseDuration(d)
		return dur
	case time.Duration:
		return d
	default:
		return time.Second
	}
}

// ParseInt64 解析配置中的整数值
func ParseInt64(v any) int64 {
	switch n := v.(type) {
	case int:
		return int64(n)
	case int64:
		return n
	case float64:
		return int64(n)
	default:
		return 0
	}
}
