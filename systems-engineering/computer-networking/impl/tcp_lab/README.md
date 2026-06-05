# TCP Lab — Chain-1

Linux-only experiments for TCP metrics and loss simulation.

## Quick Start

```bash
cd python

# View retransmit rate and TIME_WAIT count
python3 tcp_metrics.py

# Simulate packet loss (requires root + iperf3)
sudo ./simulate_loss.sh
```

## Expected Observations

- `RetransSegs / OutSegs > 1%` → network quality issue or congestion.
- `TIME_WAIT > 10000` → port exhaustion risk, tune `tcp_tw_reuse`.
- Throughput drops sharply as `tc` loss increases: CUBIC/BBR difference visible with `iperf3`.

## macOS Note

`/proc/net/*` and `tc` are Linux-only. Run inside Docker:

```bash
docker run --rm --privileged -it -v $(pwd):/lab ubuntu:22.04 bash
```
