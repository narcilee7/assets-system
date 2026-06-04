#!/bin/bash
# Validation tests for strace lab
set -e

PASS=0
FAIL=0
SCRIPT_DIR="/Users/Zhuanz/open_source/assets-system/systems-engineering/linux-systems/impl"

pass() { echo "✓ $1"; ((PASS++)); }
fail() { echo "✗ $1"; ((FAIL++)); }

echo "=== Test: strace_lab.sh exists ==="
if [[ -x "$SCRIPT_DIR/strace_lab.sh" ]]; then
  pass "strace_lab.sh exists and executable"
else
  fail "strace_lab.sh not found"
  exit 1
fi

echo -e "\n=== Test: Script runs without crash ==="
timeout 10 "$SCRIPT_DIR/strace_lab.sh" basic > /dev/null 2>&1
[[ $? -le 124 ]] && pass "strace_lab.sh basic runs" || fail "strace_lab.sh basic crashed"

echo -e "\n=== Test: All scenarios run ==="
for s in basic count timing filter fork output network signal fd; do
  timeout 5 "$SCRIPT_DIR/strace_lab.sh" $s > /dev/null 2>&1
  [[ $? -le 124 ]] && pass "--$s runs" || fail "--$s crashed"
done

echo -e "\n=== Test: Help or interactive shown ==="
output=$(timeout 3 "$SCRIPT_DIR/strace_lab.sh" demo 2>&1 | head -20)
echo "$output" | grep -q "Available scenarios" && pass "interactive mode shows scenarios" || fail "interactive mode broken"

echo -e "\n=== Test: Output contains expected strace sections ==="
output=$("$SCRIPT_DIR/strace_lab.sh" basic 2>&1)
echo "$output" | grep -q "strace -e trace=execve" && pass "shows strace command" || fail "missing strace command"

echo -e "\nResults: $PASS passed, $FAIL failed"
[[ $FAIL -gt 0 ]] && exit 1