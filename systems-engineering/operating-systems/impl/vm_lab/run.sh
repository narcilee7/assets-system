#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Virtual Memory Lab — Chain-1"
echo "=========================================="

if [[ ! -f /proc/self/status ]]; then
  echo "This lab requires Linux /proc. Please run inside Linux or Docker."
  exit 1
fi

echo -e "\n--- Python: Page Fault Counter ---"
python3 python/page_fault_counter.py

echo -e "\n--- Python: COW Demo ---"
python3 python/cow_demo.py

echo -e "\n--- Go: Memstats ---"
cd go
if [[ ! -f go.mod ]]; then
  go mod init vm_lab || true
fi
go run memstats.go
cd ..

echo -e "\n--- Java: MemoryStats ---"
cd java
javac MemoryStats.java
java MemoryStats
cd ..

echo -e "\n=========================================="
echo "  VM Lab complete"
echo "=========================================="
