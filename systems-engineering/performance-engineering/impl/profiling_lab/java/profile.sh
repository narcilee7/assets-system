#!/usr/bin/env bash
set -e

echo "=== Java + async-profiler lab ==="

echo "[1] Compile..."
javac CpuHog.java

echo "[2] Start server with PreserveFramePointer..."
java -XX:+PreserveFramePointer CpuHog &
PID=$!
sleep 1

echo "[3] Warm-up requests..."
for i in {1..5}; do
  curl -s http://localhost:8080/work > /dev/null || true
done

echo "[4] Check if async-profiler is available..."
PROFILER="./profiler.sh"
if [[ ! -x "$PROFILER" ]]; then
  echo "async-profiler not found at $PROFILER"
  echo "Download from: https://github.com/jvm-profiling-tools/async-profiler/releases"
  kill $PID || true
  exit 1
fi

echo "[5] Profile 10s and generate flame.svg..."
$PROFILER -d 10 -f flame.svg $PID

echo "[6] Stop server..."
kill $PID || true
wait $PID 2>/dev/null || true

echo "Done: flame.svg"
