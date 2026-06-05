#!/bin/bash
# Linux System Diagnostic Toolkit
# Usage: ./diag.sh [--cpu|--mem|--disk|--net|--proc|--container|--stress|--all] [pid]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERR]${NC} $1"; }

TARGET_PID=""
MODE="all"
STRESS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cpu|--mem|--disk|--net|--proc|--container)
      MODE="${1#--}"
      shift
      ;;
    --all)
      MODE="all"
      shift
      ;;
    --stress)
      STRESS=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--cpu|--mem|--disk|--net|--proc|--container|--stress|--all] [pid]"
      echo "  --cpu       CPU diagnosis"
      echo "  --mem       Memory diagnosis"
      echo "  --disk      Disk I/O diagnosis"
      echo "  --net       Network diagnosis"
      echo "  --proc      Process diagnosis"
      echo "  --container Container diagnosis"
      echo "  --stress    Run stress-ng briefly before diagnosis"
      echo "  --all       Full diagnosis (default)"
      exit 0
      ;;
    *)
      TARGET_PID="$1"
      shift
      ;;
  esac
done

# Optional stress run
if [[ "$STRESS" == true ]]; then
  if command -v stress-ng &> /dev/null; then
    log "Running stress-ng for 5s to generate load..."
    stress-ng --cpu 2 --io 2 --vm 1 --vm-bytes 128M --timeout 5s || warn "stress-ng failed"
  else
    warn "stress-ng not installed; skipping stress phase"
  fi
fi

echo "=========================================="
echo "  Linux System Diagnostic Toolkit"
echo "  Mode: $MODE | PID: ${TARGET_PID:-all}"
echo "=========================================="

# ---- CPU Diagnosis ----
diag_cpu() {
  echo -e "\n${BLUE}=== CPU DIAGNOSIS ===${NC}"

  echo -e "\n${YELLOW}1. Load Average & Uptime${NC}"
  uptime
  echo -e "\n${YELLOW}2. Top CPU Processes${NC}"
  ps aux --sort=-%cpu | head -10

  echo -e "\n${YELLOW}3. VMStat (CPU context)${NC}"
  vmstat 1 3

  echo -e "\n${YELLOW}4. per-CPU usage${NC}"
  mpstat -P ALL 1 1 || echo "(mpstat not available)"

  if [[ -n "$TARGET_PID" ]]; then
    echo -e "\n${YELLOW}5. Thread CPU distribution for PID $TARGET_PID${NC}"
    ps -eL-o pid,tid,%cpu,comm --no-headers -p "$TARGET_PID" 2>/dev/null | sort -k 3 -rn | head -10 || warn "PID $TARGET_PID not found"

    echo -e "\n${YELLOW}6. Top syscall for PID $TARGET_PID (3s sample)${NC}"
    strace -c -p "$TARGET_PID" -e trace=write,read 2>&1 || warn "strace failed"
  fi
}

# ---- Memory Diagnosis ----
diag_mem() {
  echo -e "\n${BLUE}=== MEMORY DIAGNOSIS ===${NC}"

  echo -e "\n${YELLOW}1. Memory Overview${NC}"
  free -h

  echo -e "\n${YELLOW}2. Detailed MemInfo (key metrics)${NC}"
  grep -E "MemAvailable|AnonPages|Shmem|SReclaimable|Buffers|Cached|SwapTotal|SwapFree|VmallocUsed" /proc/meminfo

  echo -e "\n${YELLOW}3. Swap Usage${NC}"
  swapon -s 2>/dev/null || echo "(swapon not available)"
  grep -E "pswp" /proc/vmstat 2>/dev/null || true

  echo -e "\n${YELLOW}4. Top Memory Processes${NC}"
  ps aux --sort=-%mem | head -10

  echo -e "\n${YELLOW}5. OOM Killer Log (recent)${NC}"
  dmesg | grep -i "oom\|killed" | tail -10 2>/dev/null || echo "(dmesg not accessible)"

  if [[ -n "$TARGET_PID" ]]; then
    echo -e "\n${YELLOW}6. Process Memory for PID $TARGET_PID${NC}"
    cat /proc/$TARGET_PID/status 2>/dev/null | grep -E "VmRSS|VmSize|VmSwap|VmData|VmStk|VmPeak" || warn "PID $TARGET_PID not found"

    echo -e "\n${YELLOW}7. Memory Maps (top anonymous)${NC}"
    pmap -x "$TARGET_PID" 2>/dev/null | sort -k 3 -rn | head -10 || warn "pmap failed"
  fi
}

# ---- Disk I/O Diagnosis ----
diag_disk() {
  echo -e "\n${BLUE}=== DISK I/O DIAGNOSIS ===${NC}"

  echo -e "\n${YELLOW}1. Disk I/O (iostat)${NC}"
  iostat -xz 1 3 2>/dev/null || echo "(iostat not available)"

  echo -e "\n${YELLOW}2. Filesystem Usage${NC}"
  df -h

  echo -e "\n${YELLOW}3. Inode Usage${NC}"
  df -i

  echo -e "\n${YELLOW}4. I/O by Process${NC}"
  iotop -b -n 3 2>/dev/null | head -30 || echo "(iotop not available, using pidstat)"
  pidstat -d 1 3 2>/dev/null | tail -20 || echo "(pidstat not available)"

  echo -e "\n${YELLOW}5. Large Files (>100M)${NC}"
  find /var/log -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k 5 -rh | head -10 || true

  echo -e "\n${YELLOW}6. Disk I/O Waiting Processes${NC}"
  ps -eo pid,comm,wchan:W20,state | sort -k 4 -rn | head -10

  if [[ -n "$TARGET_PID" ]]; then
    echo -e "\n${YELLOW}7. Open Files for PID $TARGET_PID${NC}"
    ls -la /proc/$TARGET_PID/fd 2>/dev/null | head -20 || warn "PID $TARGET_PID not found"
    echo "Total FDs: $(ls -la /proc/$TARGET_PID/fd 2>/dev/null | wc -l)"
  fi
}

# ---- Network Diagnosis ----
diag_net() {
  echo -e "\n${BLUE}=== NETWORK DIAGNOSIS ===${NC}"

  echo -e "\n${YELLOW}1. Socket Statistics${NC}"
  ss -tunapl | head -20
  echo ""
  ss -s

  echo -e "\n${YELLOW}2. TIME_WAIT Connections${NC}"
  time_wait_count=$(ss -ant state time-wait | wc -l)
  echo "TIME_WAIT count: $time_wait_count"
  if [[ $time_wait_count -gt 10000 ]]; then
    warn "TIME_WAIT count is high (>10k), consider tuning tcp_tw_reuse"
  fi

  echo -e "\n${YELLOW}3. Network Device Stats${NC}"
  cat /proc/net/dev
  echo -e "\n${YELLOW}4. TCP Retransmit Rate${NC}"
  tcp_ret=$(cat /proc/net/snmp | grep -E "RetransSegs|OutSegs" | awk '{print $3, $9}')
  echo "InSegs RetransSegs: $(echo $tcp_ret | awk '{print $1, $2}')"
  echo "OutSegs RetransSegs: $(echo $tcp_ret | awk '{print $3, $4}')"

  echo -e "\n${YELLOW}5. Socket Memory${NC}"
  cat /proc/net/sockstat

  echo -e "\n${YELLOW}6. Listen Queue${NC}"
  ss -ltn | grep -E "Listen|Recv-Q" | head -10

  if [[ -n "$TARGET_PID" ]]; then
    echo -e "\n${YELLOW}7. Network Connection for PID $TARGET_PID${NC}"
    lsof -i -a -p "$TARGET_PID" 2>/dev/null | head -20 || warn "lsof failed"
  fi
}

# ---- Process Diagnosis ----
diag_proc() {
  echo -e "\n${BLUE}=== PROCESS DIAGNOSIS ===${NC}"

  echo -e "\n${YELLOW}1. Process Tree (top CPU)${NC}"
  ps auxf --sort=-%cpu | head -30

  echo -e "\n${YELLOW}2. Zombie Processes${NC}"
  zombie_count=$(ps aux | grep -c "Z" | grep -v grep || echo "0")
  echo "Zombie count: $zombie_count"
  ps aux | grep " Z " | head -10 || true

  echo -e "\n${YELLOW}3. Thread Count Top${NC}"
  ps -eLf --sort=-%cpu | awk '{print $2}' | sort | uniq -c | sort -rn | head -10

  echo -e "\n${YELLOW}4. Context Switch Rate${NC}"
  vmstat 1 3

  if [[ -n "$TARGET_PID" ]]; then
    echo -e "\n${YELLOW}5. Full Status for PID $TARGET_PID${NC}"
    cat /proc/$TARGET_PID/status 2>/dev/null || warn "PID $TARGET_PID not found"

    echo -e "\n${YELLOW}6. Command Line${NC}"
    cat /proc/$TARGET_PID/cmdline 2>/dev/null | tr '\0' ' ' && echo

    echo -e "\n${YELLOW}7. Limits${NC}"
    cat /proc/$TARGET_PID/limits 2>/dev/null || true
  fi
}

# ---- PSI (Pressure Stall Information) ----
diag_psi() {
  echo -e "\n${BLUE}=== PRESSURE STALL INFORMATION ===${NC}"
  for res in cpu memory io; do
    if [[ -f /proc/pressure/$res ]]; then
      echo -e "\n${YELLOW}$res pressure${NC}"
      cat /proc/pressure/$res
    fi
  done
}

# ---- Container Diagnosis ----
diag_container() {
  echo -e "\n${BLUE}=== CONTAINER DIAGNOSIS ===${NC}"

  # Check if running in container
  if [[ -f /.dockerenv ]]; then
    echo -e "\n${YELLOW}Running inside container${NC}"
  fi

  # Check cgroup info
  echo -e "\n${YELLOW}1. Cgroup Info${NC}"
  if [[ -f /proc/1/cgroup ]]; then
    head -5 /proc/1/cgroup
  fi

  echo -e "\n${YELLOW}2. Memory Limits (cgroup v1/v2)${NC}"
  if [[ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]]; then
    # v1
    cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo "(not available)"
    cat /sys/fs/cgroup/memory/memory.soft_limit_in_bytes 2>/dev/null || true
    cat /sys/fs/cgroup/memory/memory.oom_control 2>/dev/null || true
  elif [[ -f /sys/fs/cgroup/memory.max ]]; then
    # v2
    cat /sys/fs/cgroup/memory.max 2>/dev/null || echo "(not available)"
    cat /sys/fs/cgroup/memory.high 2>/dev/null || true
    cat /sys/fs/cgroup/memory.events 2>/dev/null || true
  fi

  echo -e "\n${YELLOW}3. CPU Limits (cgroup v1/v2)${NC}"
  if [[ -f /sys/fs/cgroup/cpu/cpu.cfs_quota_us ]]; then
    # v1
    cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us 2>/dev/null || echo "(not available)"
    cat /sys/fs/cgroup/cpu/cpu.cfs_period_us 2>/dev/null || true
    cat /sys/fs/cgroup/cpu/cpu.shares 2>/dev/null || true
  elif [[ -f /sys/fs/cgroup/cpu.max ]]; then
    # v2
    cat /sys/fs/cgroup/cpu.max 2>/dev/null || echo "(not available)"
    cat /sys/fs/cgroup/cpu.weight 2>/dev/null || true
  fi

  echo -e "\n${YELLOW}4. Docker/Container Stats${NC}"
  if command -v docker &> /dev/null; then
    docker stats --no-stream 2>/dev/null || echo "(docker not accessible)"
  fi

  if command -v crictl &> /dev/null; then
    crictl stats 2>/dev/null || echo "(crictl not accessible)"
  fi

  echo -e "\n${YELLOW}5. Namespaces${NC}"
  if [[ -d /proc/self/ns ]]; then
    ls -la /proc/self/ns/
  fi

  echo -e "\n${YELLOW}6. OverlayFS Usage${NC}"
  if [[ -d /var/lib/docker/overlay2 ]]; then
    df -h /var/lib/docker/overlay2/
    du -sh /var/lib/docker/overlay2/* 2>/dev/null | sort -rh | head -10 || true
  fi
}

# ---- Execute based on mode ----
case $MODE in
  cpu)    diag_cpu ;;
  mem)    diag_mem ;;
  disk)   diag_disk ;;
  net)    diag_net ;;
  proc)   diag_proc ;;
  container) diag_container ;;
  all)
    diag_cpu
    diag_mem
    diag_disk
    diag_net
    diag_proc
    diag_psi
    diag_container
    ;;
esac

echo -e "\n${GREEN}Diagnostic complete at $(date)${NC}"