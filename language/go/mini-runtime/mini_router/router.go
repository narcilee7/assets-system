package minirouter

import (
	"context"
	"net/http"
	"strings"
	"sync"
)

// ===== 参数提取 =====

type ctxKey struct{}

var paramsKey = &ctxKey{}

// Param 从请求上下文中取路径参数
func Param(r *http.Request, key string) string {
	if v := r.Context().Value(paramsKey); v != nil {
		return v.(map[string]string)[key]
	}
	return ""
}

// Params 取全部参数
func Params(r *http.Request) map[string]string {
	if v := r.Context().Value(paramsKey); v != nil {
		return v.(map[string]string)
	}
	return nil
}

// ===== 中间件 =====

type Middleware func(http.Handler) http.Handler

func chain(h http.Handler, mws []Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// ===== 路由树 =====

type node struct {
	static    map[string]*node // 静态子节点
	param     *node          // :name
	paramName string
	wild      *node // *name
	wildName  string
	handler   http.Handler
}

func newNode(seg string) *node {
	n := &node{}
	if strings.HasPrefix(seg, ":") {
		n.paramName = seg[1:]
		n.param = n // 自引用标记，实际不会用到
	} else if strings.HasPrefix(seg, "*") {
		n.wildName = seg[1:]
		n.wild = n
	} else {
		n.static = make(map[string]*node)
	}
	return n
}

// ===== Router =====

type Router struct {
	mu               sync.RWMutex
	trees            map[string]*node // method -> root
	mw               []Middleware
	notFound         http.Handler
	methodNotAllowed http.Handler
}

func New() *Router {
	return &Router{
		trees: make(map[string]*node),
		notFound: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		}),
		methodNotAllowed: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}),
	}
}

func (r *Router) Use(mw ...Middleware) { r.mw = append(r.mw, mw...) }

func (r *Router) NotFound(h http.Handler)         { r.notFound = h }
func (r *Router) MethodNotAllowed(h http.Handler) { r.methodNotAllowed = h }

// Group 子路由，共享 Router 但带独立前缀和 middleware
func (r *Router) Group(prefix string, mw ...Middleware) *Group {
	return &Group{router: r, prefix: prefix, mw: mw}
}

// Handle 注册路由
func (r *Router) Handle(method, path string, h http.Handler, mws ...Middleware) {
	if path == "" || path[0] != '/' {
		panic("path must begin with /")
	}

	// 合并 middleware：Router -> Group(如有) -> Route
	all := make([]Middleware, 0, len(r.mw)+len(mws))
	all = append(all, r.mw...)
	all = append(all, mws...)
	h = chain(h, all)

	segs := split(path)
	r.mu.Lock()
	defer r.mu.Unlock()

	root, ok := r.trees[method]
	if !ok {
		root = &node{static: make(map[string]*node)}
		r.trees[method] = root
	}
	insert(root, segs, h)
}

// GET / POST / PUT / DELETE 快捷方法
func (r *Router) GET(p string, h http.HandlerFunc, mws ...Middleware) {
	r.Handle(http.MethodGet, p, h, mws...)
}
func (r *Router) POST(p string, h http.HandlerFunc, mws ...Middleware) {
	r.Handle(http.MethodPost, p, h, mws...)
}
func (r *Router) PUT(p string, h http.HandlerFunc, mws ...Middleware) {
	r.Handle(http.MethodPut, p, h, mws...)
}
func (r *Router) DELETE(p string, h http.HandlerFunc, mws ...Middleware) {
	r.Handle(http.MethodDelete, p, h, mws...)
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	r.mu.RLock()
	root, ok := r.trees[req.Method]
	r.mu.RUnlock()
	if !ok {
		r.notFound.ServeHTTP(w, req)
		return
	}

	segs := split(req.URL.Path)
	params := make(map[string]string)
	h := search(root, segs, params)

	if h == nil {
		// 405 检测：其他 method 有该 path 吗？
		if r.pathExists(req.URL.Path) {
			r.methodNotAllowed.ServeHTTP(w, req)
			return
		}
		r.notFound.ServeHTTP(w, req)
		return
	}

	ctx := context.WithValue(req.Context(), paramsKey, params)
	h.ServeHTTP(w, req.WithContext(ctx))
}

// pathExists 检查是否有任意 method 匹配该 path（用于 405）
func (r *Router) pathExists(path string) bool {
	segs := split(path)
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, root := range r.trees {
		if search(root, segs, nil) != nil {
			return true
		}
	}
	return false
}

// ===== 内部：树操作 =====

func split(path string) []string {
	if path == "/" {
		return nil
	}
	p := path[1:] // 去掉首 /
	return strings.Split(p, "/")
}

func insert(root *node, segs []string, h http.Handler) {
	cur := root
	for _, seg := range segs {
		if seg == "" {
			continue
		}
		// 参数节点
		if strings.HasPrefix(seg, ":") {
			if cur.param == nil {
				cur.param = newNode(seg)
			}
			cur = cur.param
			continue
		}
		// 通配节点
		if strings.HasPrefix(seg, "*") {
			if cur.wild == nil {
				cur.wild = newNode(seg)
			}
			cur = cur.wild
			continue
		}
		// 静态节点
		if cur.static == nil {
			cur.static = make(map[string]*node)
		}
		next, ok := cur.static[seg]
		if !ok {
			next = newNode(seg)
			cur.static[seg] = next
		}
		cur = next
	}
	cur.handler = h
}

func search(root *node, segs []string, params map[string]string) http.Handler {
	cur := root
	for i, seg := range segs {
		if seg == "" {
			continue
		}
		// 1. 先匹配静态
		if next, ok := cur.static[seg]; ok {
			cur = next
			continue
		}
		// 2. 再匹配参数
		if cur.param != nil {
			if params != nil {
				params[cur.param.paramName] = seg
			}
			cur = cur.param
			continue
		}
		// 3. 最后匹配通配，吞掉剩余路径
		if cur.wild != nil {
			if params != nil {
				params[cur.wild.wildName] = strings.Join(segs[i:], "/")
			}
			return cur.wild.handler
		}
		return nil
	}
	return cur.handler
}

// ===== Group 子路由 =====

type Group struct {
	router *Router
	prefix string
	mw     []Middleware
}

func (g *Group) GET(p string, h http.HandlerFunc, mws ...Middleware) {
	g.handle(http.MethodGet, p, h, mws)
}
func (g *Group) POST(p string, h http.HandlerFunc, mws ...Middleware) {
	g.handle(http.MethodPost, p, h, mws)
}
func (g *Group) PUT(p string, h http.HandlerFunc, mws ...Middleware) {
	g.handle(http.MethodPut, p, h, mws)
}
func (g *Group) DELETE(p string, h http.HandlerFunc, mws ...Middleware) {
	g.handle(http.MethodDelete, p, h, mws)
}

func (g *Group) handle(method, path string, h http.HandlerFunc, mws []Middleware) {
	all := make([]Middleware, 0, len(g.mw)+len(mws))
	all = append(all, g.mw...)
	all = append(all, mws...)
	g.router.Handle(method, g.prefix+path, h, all...)
}