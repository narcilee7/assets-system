#!/usr/bin/env bash
set -e

PORT=8080
DURATION=10s
CONCURRENCY=100

echo "=========================================="
echo "  I/O Model Lab Benchmark"
echo "=========================================="

if ! command -v wrk &> /dev/null && ! command -v hey &> /dev/null; then
  echo "Please install wrk or hey first"
  exit 1
fi

run_bench() {
  local name=$1
  local cmd=$2
  echo -e "\n--- $name ---"
  $cmd &
  PID=$!
  sleep 1

  if command -v wrk &> /dev/null; then
    wrk -t4 -c$CONCURRENCY -d$DURATION --latency http://127.0.0.1:$PORT/ || true
  else
    hey -z $DURATION -c $CONCURRENCY http://127.0.0.1:$PORT/ || true
  fi

  kill $PID || true
  wait $PID 2>/dev/null || true
}

# Simple echo payload: send "hello" and expect same back.
# These servers are raw TCP echo; wrk expects HTTP.
# For a fair benchmark, use a lightweight HTTP wrapper or netcat flood.
# Below is a placeholder using nc flood for TCP echo.

flood() {
  local name=$1
  local cmd=$2
  echo -e "\n--- $name (nc flood) ---"
  $cmd &
  PID=$!
  sleep 1

  # Send 100k lines via multiple background nc's (best effort)
  for i in {1..10}; do
    (for j in {1..10000}; do echo "hello"; done) | nc -q0 127.0.0.1 $PORT &
  done
  wait
  kill $PID || true
  wait $PID 2>/dev/null || true
}

echo "Note: These are raw TCP echo servers. Use netcat or adapt to HTTP for wrk."
echo "See README.md for language-specific run instructions."
