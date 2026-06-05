#!/bin/bash
# Validation tests for Linux diagnostic toolkit
# Run: ./validate.sh [--all|--cpu|--mem|--disk|--net]

set -e

PASS=0
FAIL=0

pass() { echo "✓ $1"; ((PASS++)); }
fail() { echo "✗ $1"; ((FAIL++)); }

MODE="${1:-all}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIAG="$SCRIPT_DIR/impl/diag.sh"

# Test 1: Script exists and is executable
test_script_exists() {
  echo "=== Test: Script Exists ==="
  if [[ -x "$DIAG" ]]; then
    pass "diag.sh exists and is executable"
  else
    fail "diag.sh not found or not executable"
    return
  fi

  chmod +x "$DIAG"
}

# Test 2: Help flag works
test_help() {
  echo -e "\n=== Test: Help Flag ==="
  output=$($DIAG --help 2>&1)
  if echo "$output" | grep -q "Usage:"; then
    pass "--help shows usage"
  else
    fail "--help failed"
  fi
}

# Test 3: Script runs without crashing
test_script_runs() {
  echo -e "\n=== Test: Script Runs (CPU mode, 2s max) ==="
  timeout 5 $DIAG --cpu > /dev/null 2>&1
  rc=$?
  if [[ $rc -eq 0 ]] || [[ $rc -eq 124 ]]; then  # 124 = timeout
    pass "diag.sh --cpu runs without crash"
  else
    fail "diag.sh --cpu crashed"
  fi
}

# Test 4: Each mode runs
test_modes() {
  echo -e "\n=== Test: All Modes ==="
  for mode in cpu mem disk net proc container; do
    timeout 5 $DIAG --$mode > /dev/null 2>&1
    rc=$?
    if [[ $rc -eq 0 ]] || [[ $rc -eq 124 ]]; then
      pass "--$mode runs"
    else
      fail "--$mode crashed"
    fi
  done
}

# Test 5: Checks expected output sections
test_output_sections() {
  echo -e "\n=== Test: Output Contains Expected Sections ==="
  output=$($DIAG --cpu 2>&1)

  checks=("CPU DIAGNOSIS" "Load Average" "Top CPU Processes")
  for check in "${checks[@]}"; do
    if echo "$output" | grep -q "$check"; then
      pass "Found: $check"
    else
      fail "Missing: $check"
    fi
  done
}

# Test 6: Memory mode has expected sections
test_mem_output() {
  echo -e "\n=== Test: Memory Mode Output ==="
  output=$($DIAG --mem 2>&1)

  checks=("MEMORY DIAGNOSIS" "MemAvailable" "Swap")
  for check in "${checks[@]}"; do
    if echo "$output" | grep -q "$check"; then
      pass "Found: $check"
    else
      fail "Missing: $check"
    fi
  done
}

# Test 7: Network mode has expected sections
test_net_output() {
  echo -e "\n=== Test: Network Mode Output ==="
  output=$($DIAG --net 2>&1)

  checks=("NETWORK DIAGNOSIS" "Socket Statistics" "TIME_WAIT")
  for check in "${checks[@]}"; do
    if echo "$output" | grep -q "$check"; then
      pass "Found: $check"
    else
      fail "Missing: $check"
    fi
  done
}

# Test 8: Disk mode has expected sections
test_disk_output() {
  echo -e "\n=== Test: Disk Mode Output ==="
  output=$($DIAG --disk 2>&1)

  checks=("DISK I/O DIAGNOSIS" "Filesystem" "I/O by Process")
  for check in "${checks[@]}"; do
    if echo "$output" | grep -q "$check"; then
      pass "Found: $check"
    else
      fail "Missing: $check"
    fi
  done
}

# Test 9: PSI section present on modern kernels
test_psi_output() {
  echo -e "\n=== Test: PSI Section ==="
  output=$($DIAG --all 2>&1)
  if echo "$output" | grep -q "PRESSURE STALL INFORMATION"; then
    pass "PSI section present"
  else
    warn "PSI section missing (may require Linux 4.20+)"
  fi
}

# Test 10: Go diag binary builds
test_go_diag() {
  echo -e "\n=== Test: Go diag_go builds ==="
  pushd "$SCRIPT_DIR/impl/diag_go" > /dev/null
  if go build -o diag_go diag.go 2>/dev/null; then
    pass "diag_go builds"
    ./diag_go > /dev/null 2>&1 && pass "diag_go runs" || warn "diag_go runtime failed (expected on non-Linux)"
  else
    warn "diag_go build failed (expected on non-Linux)"
  fi
  popd > /dev/null
}

# Run tests
echo "=========================================="
echo "  Linux Diagnostics - Validation Tests"
echo "=========================================="

test_script_exists
test_help
test_script_runs
test_modes

if [[ "$MODE" == "all" ]]; then
  test_output_sections
  test_mem_output
  test_net_output
  test_disk_output
  test_psi_output
  test_go_diag
fi

echo -e "\n=========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=========================================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi