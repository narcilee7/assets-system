package main

import (
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"time"
)

// cpuIntensive burns CPU with a naive Fibonacci.
func cpuIntensive(n int) int {
	if n <= 1 {
		return n
	}
	return cpuIntensive(n-1) + cpuIntensive(n-2)
}

func main() {
	http.HandleFunc("/work", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		result := cpuIntensive(38)
		fmt.Fprintf(w, "result=%d duration=%s\n", result, time.Since(start))
	})

	fmt.Println("Listening on :8080")
	fmt.Println("pprof CPU profile: curl -s http://localhost:8080/debug/pprof/profile?seconds=10 > cpu.prof")
	fmt.Println("pprof heap:        curl -s http://localhost:8080/debug/pprof/heap > heap.prof")
	fmt.Println("Then: go tool pprof -http=:8081 cpu.prof")
	panic(http.ListenAndServe(":8080", nil))
}
