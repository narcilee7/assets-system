#!/usr/bin/env bash
set -e

echo "=== Python cProfile + flameprof lab ==="

echo "[1] Start server in background with cProfile..."
python -m cProfile -o stats.prof cpu_hog.py &
PID=$!
sleep 1

echo "[2] Warm-up request..."
curl -s http://localhost:8080/work || true

echo "[3] Collecting 5 requests..."
for i in {1..5}; do
  curl -s http://localhost:8080/work > /dev/null || true
done

echo "[4] Stop server..."
kill $PID || true
wait $PID 2>/dev/null || true

echo "[5] Generate flame graph..."
if command -v flameprof &> /dev/null; then
  flameprof stats.prof > flame.svg
  echo "Generated flame.svg"
else
  echo "flameprof not installed. Install: pip install flameprof"
fi

echo "[6] Optional: snakeviz stats.prof"
