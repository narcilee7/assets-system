#!/usr/bin/env bash
set -e

# Simulate packet loss with tc and measure throughput with iperf3.
# Requires: iperf3, tc (root), two Linux hosts or loopback.

INTERFACE="${INTERFACE:-lo}"
SERVER="${SERVER:-127.0.0.1}"
DURATION=10

echo "=========================================="
echo "  TCP Loss Simulation Lab"
echo "=========================================="

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (for tc)"
   exit 1
fi

# Ensure iperf3 server is running
if ! pgrep -x iperf3 > /dev/null; then
  echo "Starting iperf3 server..."
  iperf3 -s -D
  sleep 1
fi

run_test() {
  local loss=$1
  echo -e "\n--- Testing with ${loss}% loss ---"

  # Add loss qdisc
  tc qdisc add dev $INTERFACE root netem loss ${loss}% || tc qdisc change dev $INTERFACE root netem loss ${loss}%

  # Run iperf3 client
  iperf3 -c $SERVER -t $DURATION -J > iperf_${loss}.json || true

  # Parse basic result
  if [[ -f iperf_${loss}.json ]]; then
    local bits=$(python3 -c "import json,sys; d=json.load(open('iperf_${loss}.json')); print(d['end']['sum_received']['bits_per_second'])" 2>/dev/null || echo "0")
    local mbits=$(python3 -c "print(f'{float($bits)/1e6:.2f}')" 2>/dev/null || echo "0")
    echo "Throughput: ${mbits} Mbps"
  fi

  # Reset
  tc qdisc del dev $INTERFACE root || true
}

for loss in 0 1 5 10; do
  run_test $loss
done

# Cleanup iperf3 server
pkill iperf3 || true

echo -e "\nResults saved to iperf_*.json"
