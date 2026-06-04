#!/bin/bash
# Validation tests for Linux diagnostic toolkit
# Run: ./validate.sh [--all|--cpu|--mem|--disk|--net]

set -e

PASS=0
FAIL=0

pass() { echo "✓ $1"; ((PASS++)); }
fail() { echo "✗ $1"; ((FAIL++)); }

MODE="${1:-all}"

# Test 1: Script exists and is executable
test_script_exists() {
  echo "=== Test: Script Exists ==="
  if [[ -x "/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh" ]]; then
    pass "diag.sh exists and is executable"
  else
    fail "diag.sh not found or not executable"
    return
  fi

  # Make executable
  chmod +x "/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh"
}

# Test 2: Help flag works
test_help() {
  echo -e "\n=== Test: Help Flag ==="
  output=$(/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --help 2>&1)
  if echo "$output" | grep -q "Usage:"; then
    pass "--help shows usage"
  else
    fail "--help failed"
  fi
}

# Test 3: Script runs without crashing
test_script_runs() {
  echo -e "\n=== Test: Script Runs (CPU mode, 2s max) ==="
  timeout 5 /Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --cpu > /dev/null 2>&1
  if [[ $? -eq 0 ]] || [[ $? -eq 124 ]]; then  # 124 = timeout
    pass "diag.sh --cpu runs without crash"
  else
    fail "diag.sh --cpu crashed"
  fi
}

# Test 4: Each mode runs
test_modes() {
  echo -e "\n=== Test: All Modes ==="
  for mode in cpu mem disk net proc container; do
    timeout 5 /Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --$mode > /dev/null 2>&1
    if [[ $? -eq 0 ]] || [[ $? -eq 124 ]]; then
      pass "--$mode runs"
    else
      fail "--$mode crashed"
    fi
  done
}

# Test 5: Checks expected output sections
test_output_sections() {
  echo -e "\n=== Test: Output Contains Expected Sections ==="
  output=$(/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --cpu 2>&1)

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
  output=$(/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --mem 2>&1)

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
  output=$(/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --net 2>&1)

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
  output=$(/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl/diag.sh --disk 2>&1)

  checks=("DISK I/O DIAGNOSIS" "Filesystem" "I/O by Process")
  for check in "${checks[@]}"; do
    if echo "$output" | grep -q "$check"; then
      pass "Found: $check"
    else
      fail "Missing: $check"
    fi
  done
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
fi

echo -e "\n=========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=========================================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi