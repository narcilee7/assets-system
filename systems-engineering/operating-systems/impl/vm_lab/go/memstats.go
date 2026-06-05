//go:build linux

package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func readStatus(field string) string {
	f, err := os.Open("/proc/self/status")
	if err != nil {
		return "N/A"
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, field+":") {
			return strings.TrimSpace(strings.TrimPrefix(line, field+":"))
		}
	}
	return "N/A"
}

func main() {
	fmt.Println("=== Virtual Memory Observation (Go) ===")
	fmt.Println("Before allocation:")
	fmt.Println("  VmSize:", readStatus("VmSize"))
	fmt.Println("  VmRSS: ", readStatus("VmRSS"))

	// Allocate 100MB but do not touch
	_ = make([]byte, 100*1024*1024)

	fmt.Println("\nAfter allocation (no touch):")
	fmt.Println("  VmSize:", readStatus("VmSize"))
	fmt.Println("  VmRSS: ", readStatus("VmRSS"))

	// Touch every page
	data := make([]byte, 100*1024*1024)
	for i := range data {
		if i%4096 == 0 {
			data[i] = 1
		}
	}

	fmt.Println("\nAfter touch:")
	fmt.Println("  VmSize:", readStatus("VmSize"))
	fmt.Println("  VmRSS: ", readStatus("VmRSS"))
}
