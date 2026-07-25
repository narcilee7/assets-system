package config

import (
	"encoding"
	"errors"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// ===== 接口层：小接口表达依赖 =====

// Source 配置源
type Source interface {
	Get(key string) (string, bool)
}

// EnvSource 环境变量源
type EnvSource struct{ Prefix string }

func (e *EnvSource) Get(key string) (string, bool) {
	return os.LookupEnv(e.Prefix + key)
}

// MapSource 内存 map 源（测试用）
type MapSource map[string]string

func (m MapSource) Get(key string) (string, bool) {
	v, ok := m[key]
	return v, ok
}

// ===== 加载器 =====

// Loader 组合多个 Source + 后置校验
type Loader struct {
	sources    []Source
	validators []func(any) error
}

func NewLoader(sources ...Source) *Loader {
	return &Loader{sources: sources}
}

// WithValidator 链式添加校验器
func (l *Loader) WithValidator(v func(any) error) *Loader {
	l.validators = append(l.validators, v)
	return l
}

// Load 从环境变量加载到结构体
// 支持 struct tag: `env:"KEY" default:"val" required:"true"`
func (l *Loader) Load(cfg any) error {
	if cfg == nil {
		return errors.New("config target is nil")
	}

	rv := reflect.ValueOf(cfg)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		return errors.New("config target must be a non-nil pointer")
	}

	if err := l.loadStruct(rv.Elem(), ""); err != nil {
		return fmt.Errorf("config load: %w", err)
	}

	for _, v := range l.validators {
		if err := v(cfg); err != nil {
			return fmt.Errorf("config validate: %w", err)
		}
	}

	return nil
}

// ===== 反射解析核心 =====

func (l *Loader) loadStruct(v reflect.Value, prefix string) error {
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fv := v.Field(i)

		if !field.IsExported() || !fv.CanSet() {
			continue
		}

		envTag := field.Tag.Get("env")
		if envTag == "-" {
			continue
		}

		// 计算 key：env tag > 字段名
		key := envTag
		if key == "" {
			key = field.Name
		}
		key = prefix + key

		// 嵌套结构体递归（time.Duration 除外，它实现了 TextUnmarshaler）
		if fv.Kind() == reflect.Struct && field.Type != reflect.TypeOf(time.Duration(0)) {
			if _, ok := fv.Addr().Interface().(encoding.TextUnmarshaler); !ok {
				subPrefix := key + "_"
				if err := l.loadStruct(fv, subPrefix); err != nil {
					return fmt.Errorf("%s: %w", field.Name, err)
				}
				continue
			}
		}

		if err := l.loadField(field, fv, key); err != nil {
			return fmt.Errorf("%s: %w", field.Name, err)
		}
	}
	return nil
}

func (l *Loader) loadField(field reflect.StructField, v reflect.Value, key string) error {
	// 1. 从 sources 查找
	var val string
	found := false
	for _, src := range l.sources {
		if s, ok := src.Get(key); ok {
			val = s
			found = true
			break
		}
	}

	// 2. 默认值回退
	if !found {
		if def := field.Tag.Get("default"); def != "" {
			val = def
			found = true
		}
	}

	// 3. 必填检查
	if !found && field.Tag.Get("required") == "true" {
		return fmt.Errorf("required env %q is missing", key)
	}

	// 4. 解析写入
	if found {
		if err := parseValue(v, val); err != nil {
			return fmt.Errorf("parse %q=%q: %w", key, val, err)
		}
	}

	return nil
}

// parseValue 字符串 -> reflect.Value
func parseValue(v reflect.Value, s string) error {
	// 优先自定义 TextUnmarshaler（time.Duration、url.URL 等）
	if u, ok := v.Addr().Interface().(encoding.TextUnmarshaler); ok {
		return u.UnmarshalText([]byte(s))
	}

	switch v.Kind() {
	case reflect.String:
		v.SetString(s)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		if v.Type() == reflect.TypeOf(time.Duration(0)) {
			d, err := time.ParseDuration(s)
			if err != nil {
				return err
			}
			v.SetInt(int64(d))
			return nil
		}
		i, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			return err
		}
		v.SetInt(i)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		i, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return err
		}
		v.SetUint(i)
	case reflect.Float32, reflect.Float64:
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return err
		}
		v.SetFloat(f)
	case reflect.Bool:
		b, err := strconv.ParseBool(s)
		if err != nil {
			return err
		}
		v.SetBool(b)
	case reflect.Slice:
		if v.Type().Elem().Kind() == reflect.String {
			parts := strings.Split(s, ",")
			for i, p := range parts {
				parts[i] = strings.TrimSpace(p)
			}
			v.Set(reflect.ValueOf(parts))
			return nil
		}
		return fmt.Errorf("unsupported slice type %v", v.Type())
	default:
		return fmt.Errorf("unsupported type %v", v.Type())
	}
	return nil
}

// ===== 显式辅助函数（更 Go 风格，不用反射） =====

func MustString(src Source, key, def string) string {
	if v, ok := src.Get(key); ok {
		return v
	}
	return def
}

func MustInt(src Source, key string, def int) int {
	s, ok := src.Get(key)
	if !ok {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func MustDuration(src Source, key string, def time.Duration) time.Duration {
	s, ok := src.Get(key)
	if !ok {
		return def
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return def
	}
	return d
}

func MustURL(src Source, key string, def *url.URL) (*url.URL, error) {
	s, ok := src.Get(key)
	if !ok {
		return def, nil
	}
	u, err := url.Parse(s)
	if err != nil {
		return nil, fmt.Errorf("parse URL %q: %w", key, err)
	}
	return u, nil
}

// ===== 校验器 =====

// Required 检查字段非零值
func Required(fields ...string) func(any) error {
	return func(cfg any) error {
		v := reflect.ValueOf(cfg)
		if v.Kind() == reflect.Ptr {
			v = v.Elem()
		}
		for _, name := range fields {
			fv := v.FieldByName(name)
			if !fv.IsValid() {
				return fmt.Errorf("field %q not found", name)
			}
			if fv.IsZero() {
				return fmt.Errorf("field %q is required", name)
			}
		}
		return nil
	}
}

// OneOf 枚举检查
func OneOf(field string, allowed []string) func(any) error {
	allowedMap := make(map[string]bool, len(allowed))
	for _, a := range allowed {
		allowedMap[a] = true
	}
	return func(cfg any) error {
		v := reflect.ValueOf(cfg)
		if v.Kind() == reflect.Ptr {
			v = v.Elem()
		}
		fv := v.FieldByName(field)
		if !fv.IsValid() {
			return fmt.Errorf("field %q not found", field)
		}
		val := fmt.Sprintf("%v", fv.Interface())
		if !allowedMap[val] {
			return fmt.Errorf("field %q=%q not in %v", field, val, allowed)
		}
		return nil
	}
}

// Range 数值范围
func Range(field string, min, max float64) func(any) error {
	return func(cfg any) error {
		v := reflect.ValueOf(cfg)
		if v.Kind() == reflect.Ptr {
			v = v.Elem()
		}
		fv := v.FieldByName(field)
		if !fv.IsValid() {
			return fmt.Errorf("field %q not found", field)
		}
		var val float64
		switch fv.Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			val = float64(fv.Int())
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			val = float64(fv.Uint())
		case reflect.Float32, reflect.Float64:
			val = fv.Float()
		default:
			return fmt.Errorf("field %q is not numeric", field)
		}
		if val < min || val > max {
			return fmt.Errorf("field %q=%v not in range [%v, %v]", field, val, min, max)
		}
		return nil
	}
}