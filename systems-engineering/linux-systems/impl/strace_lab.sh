#!/bin/bash
# Strace Syscall Lab - Practical Examples
# Usage: ./strace_lab.sh [scenario]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCENARIO="${1:-demo}"
DEMO_PID="$$"

section() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Demo: trace current shell's basic syscalls
demo_basic() {
  section "Demo 1: Basic strace usage"

  echo "Tracing a simple 'ls' command..."
  strace -e trace=execve -c ls /tmp > /dev/null 2>&1
  echo "strace -e trace=execve -c ls /tmp"
  strace -e trace=execve -c ls /tmp 2>&1 | tail -10
}

# Demo: count syscalls for a command
demo_count() {
  section "Demo 2: Syscall count for 'cat /dev/null'"

  echo "Total syscalls for cat /dev/null:"
  strace -c cat /dev/null 2>&1 | tail -5

  echo -e "\nTotal syscalls for 'echo hello':"
  strace -c echo hello 2>&1 | tail -5
}

# Demo: timing analysis
demo_timing() {
  section "Demo 3: Timing analysis"

  echo "Tracing ls with relative timestamps:"
  strace -r ls /tmp > /dev/null 2>&1
  strace -r ls /tmp 2>&1 | head -20
}

# Demo: filter specific syscalls
demo_filter() {
  section "Demo 4: Filter specific syscalls (read/write only)"

  echo "Only show read/write syscalls for 'cat /etc/hostname':"
  strace -e trace=read,write cat /etc/hostname 2>&1 | grep -v " = " | head -20
}

# Demo: trace subprocess with -f
demo_fork() {
  section "Demo 5: Trace child processes (fork/clone)"

  echo "Trace fork behavior with -f:"
  strace -f -e trace=fork,clone,execve -c bash -c "echo hello" 2>&1 | tail -10
}

# Demo: output to file
demo_output() {
  section "Demo 6: Output to file"

  TMPFILE="/tmp/strace_lab_$$.log"
  echo "Tracing to file: $TMPFILE"
  strace -o "$TMPFILE" ls /tmp 2>/dev/null
  echo "First 10 lines of trace:"
  head -10 "$TMPFILE"
  rm -f "$TMPFILE"
}

# Demo: trace network syscalls
demo_network() {
  section "Demo 7: Network syscalls (curl localhost)"

  # Only run if localhost is reachable
  if curl -s --max-time 1 http://127.0.0.1:80 > /dev/null 2>&1 || true; then
    echo "Note: Run 'strace -e trace=send,recv,connect,accept curl http://localhost' to trace HTTP"
    echo "Simulated trace for curl:"
    strace -e trace=send,recv,connect,accept -c curl --max-time 1 http://127.0.0.1 2>&1 | tail -5
  else
    echo "localhost not reachable, showing general network trace:"
    strace -e trace=socket,connect,send,recv -c true 2>&1 | tail -5
  fi
}

# Demo: signal tracing
demo_signal() {
  section "Demo 8: Signal tracing"

  echo "Trace signals in current shell:"
  strace -e trace=signal -c bash -c "sleep 1" 2>&1 | tail -5
}

# Demo: file descriptor tracing
demo_fd() {
  section "Demo 9: File descriptor operations"

  echo "Trace open/close to detect FD usage:"
  strace -e trace=open,openat,close,dup -c bash -c "echo test" 2>&1 | tail -5
}

# Interactive: let user trace something
interactive() {
  section "Interactive Mode"

  echo "Available scenarios:"
  echo "  1. basic      - Basic strace usage"
  echo "  2. count      - Count syscalls"
  echo "  3. timing     - Timing analysis (-r)"
  echo "  4. filter     - Filter specific syscalls"
  echo "  5. fork       - Trace child processes"
  echo "  6. output      - Output to file"
  echo "  7. network    - Network syscall tracing"
  echo "  8. signal     - Signal tracing"
  echo "  9. fd         - File descriptor tracing"
  echo "  10. all        - Run all demos"

  echo -e "\nUsage: $0 <scenario>"

  case "$SCENARIO" in
    1|basic)     demo_basic ;;
    2|count)     demo_count ;;
    3|timing)    demo_timing ;;
    4|filter)    demo_filter ;;
    5|fork)      demo_fork ;;
    6|output)    demo_output ;;
    7|network)   demo_network ;;
    8|signal)    demo_signal ;;
    9|fd)        demo_fd ;;
    all)         run_all ;;
    *)           echo "Unknown scenario: $SCENARIO" ;;
  esac
}

run_all() {
  demo_basic
  demo_count
  demo_timing
  demo_filter
  demo_fork
  demo_output
  demo_network
  demo_signal
  demo_fd
}

# Check if running interactively
if [[ "$SCENARIO" == "demo" ]]; then
  interactive
else
  case "$SCENARIO" in
    1|basic)     demo_basic ;;
    2|count)     demo_count ;;
    3|timing)    demo_timing ;;
    4|filter)    demo_filter ;;
    5|fork)      demo_fork ;;
    6|output)    demo_output ;;
    7|network)   demo_network ;;
    8|signal)    demo_signal ;;
    9|fd)        demo_fd ;;
    all)         run_all ;;
  esac
fi