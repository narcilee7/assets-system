#!/usr/bin/env bash
set -e

echo "=== Node.js --prof lab ==="

echo "[1] Install deps..."
npm install

echo "[2] Start server with --prof..."
node --prof cpu_hog.ts &
PID=$!
sleep 1

echo "[3] Warm-up requests..."
for i in {1..5}; do
  curl -s http://localhost:8080/work > /dev/null || true
done

echo "[4] Stop server..."
kill $PID || true
wait $PID 2>/dev/null || true

echo "[5] Process profile..."
node --prof-process isolate-*.log > profile.txt
echo "Done: profile.txt"

echo "[6] Optional: use 0x for flame graph"
echo "   npx 0x cpu_hog.ts"
