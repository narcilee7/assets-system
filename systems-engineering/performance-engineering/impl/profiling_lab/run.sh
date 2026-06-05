#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Profiling Lab — Chain-1"
echo "=========================================="

run_go() {
  echo -e "\n--- Go ---"
  cd go
  go build -o cpu_hog cpu_hog.go
  ./cpu_hog &
  PID=$!
  sleep 1
  curl -s http://localhost:8080/work > /dev/null
  kill $PID || true
  wait $PID 2>/dev/null || true
  echo "Go binary built. Run 'go tool pprof' against :8080/debug/pprof"
  cd ..
}

run_python() {
  echo -e "\n--- Python ---"
  cd python
  ./profile.sh || echo "Python profiling skipped (flameprof may be missing)"
  cd ..
}

run_java() {
  echo -e "\n--- Java ---"
  cd java
  if [[ -x ./profiler.sh ]]; then
    ./profile.sh || echo "Java profiling skipped"
  else
    echo "async-profiler not found; skipping Java flame graph generation"
  fi
  cd ..
}

run_ts() {
  echo -e "\n--- TypeScript / Node.js ---"
  cd ts
  ./profile.sh || echo "TS profiling skipped"
  cd ..
}

run_go
run_python
run_java
run_ts

echo -e "\n=========================================="
echo "  Profiling Lab complete"
echo "=========================================="
