//go:build linux

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type DiagResult struct {
	Hostname    string                 `json:"hostname"`
	LoadAvg     []string               `json:"loadavg"`
	MemInfo     map[string]string      `json:"meminfo"`
	TopCPU      []map[string]string    `json:"top_cpu"`
	TopMem      []map[string]string    `json:"top_mem"`
	PSI         map[string]string      `json:"psi,omitempty"`
}

func readFile(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines, scanner.Err()
}

func parseMemInfo() map[string]string {
	m := make(map[string]string)
	lines, err := readFile("/proc/meminfo")
	if err != nil {
		return m
	}
	keys := map[string]bool{
		"MemTotal": true, "MemAvailable": true, "MemFree": true,
		"Buffers": true, "Cached": true, "SwapTotal": true, "SwapFree": true,
		"AnonPages": true, "Shmem": true, "SReclaimable": true,
	}
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			key := strings.TrimSuffix(parts[0], ":")
			if keys[key] {
				m[key] = parts[1] + " kB"
			}
		}
	}
	return m
}

func parseLoadAvg() []string {
	lines, err := readFile("/proc/loadavg")
	if err != nil || len(lines) == 0 {
		return nil
	}
	fields := strings.Fields(lines[0])
	if len(fields) >= 3 {
		return fields[:3]
	}
	return nil
}

func parsePSI() map[string]string {
	m := make(map[string]string)
	for _, res := range []string{"cpu", "memory", "io"} {
		lines, err := readFile("/proc/pressure/" + res)
		if err != nil {
			continue
		}
		for _, line := range lines {
			if strings.HasPrefix(line, "some") {
				m[res] = strings.TrimSpace(strings.TrimPrefix(line, "some"))
			}
		}
	}
	return m
}

func topProcesses(sortKey string, n int) []map[string]string {
	var result []map[string]string
	// Walk /proc for process list. In production prefer a proper library.
	_ = sortKey // reserved for future sorting
	f, err := os.Open("/proc")
	if err != nil {
		return result
	}
	defer f.Close()
	entries, _ := f.Readdirnames(-1)
	count := 0
	for _, name := range entries {
		pid, err := strconv.Atoi(name)
		if err != nil {
			continue
		}
		statusLines, err := readFile(fmt.Sprintf("/proc/%d/status", pid))
		if err != nil {
			continue
		}
		item := map[string]string{"pid": name}
		for _, line := range statusLines {
			if strings.HasPrefix(line, "Name:") {
				item["comm"] = strings.TrimSpace(strings.TrimPrefix(line, "Name:"))
			}
			if strings.HasPrefix(line, "VmRSS:") {
				item["rss"] = strings.TrimSpace(strings.TrimPrefix(line, "VmRSS:"))
			}
		}
		result = append(result, item)
		count++
		if count >= n {
			break
		}
	}
	return result
}

func main() {
	hostname, _ := os.Hostname()
	res := DiagResult{
		Hostname: hostname,
		LoadAvg:  parseLoadAvg(),
		MemInfo:  parseMemInfo(),
		TopCPU:   topProcesses("pcpu", 5),
		TopMem:   topProcesses("pmem", 5),
		PSI:      parsePSI(),
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(res)
}
