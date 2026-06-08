# Go stdlib net/http

Go 标准库 `net/http` 足以构建生产级服务，理解它是掌握任何框架的基础。

## 核心实现

```go
// stdlib_server.go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func main() {
	mux := http.NewServeMux()

	// 基础路由
	mux.HandleFunc("/", homeHandler)
	mux.HandleFunc("/api/users", usersHandler)
	mux.HandleFunc("/api/users/", userDetailHandler)

	// 中间件链
	handler := loggingMiddleware(recoveryMiddleware(corsMiddleware(mux)))

	server := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	fmt.Println("Server listening on :8080")
	server.ListenAndServe()
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode([]string{"alice", "bob"})
	case http.MethodPost:
		var user map[string]interface{}
		json.NewDecoder(r.Body).Decode(&user)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(user)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func userDetailHandler(w http.ResponseWriter, r *http.Request) {
	// 提取 ID: /api/users/123
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	id := parts[2]
	json.NewEncoder(w).Encode(map[string]string{"id": id, "name": "User " + id})
}

// 中间件
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("%s %s\n", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```
