function minWindow(s, t) {
  const need = new Map();
  for (const c of t) {
    need.set(c, (need.get(c) || 0) + 1);
  }

  const window = new Map();
  let valid = 0; // 满足 need 条件的字符种类数

  let left = 0,
    right = 0;
  let start = 0,
    len = Infinity;

  while (right < s.length) {
    const c = s[right];
    right++;

    // 扩张：更新 window
    if (need.has(c)) {
      window.set(c, (window.get(c) || 0) + 1);
      if (window.get(c) === need.get(c)) {
        valid++;
      }
    }

    // 收缩：窗口已满足条件时，尝试左移
    while (valid === need.size) {
      // 更新最小窗口
      if (right - left < len) {
        start = left;
        len = right - left;
      }

      const d = s[left];
      left++;

      if (need.has(d)) {
        if (window.get(d) === need.get(d)) {
          valid--;
        }
        window.set(d, window.get(d) - 1);
      }
    }
  }

  return len === Infinity ? "" : s.substring(start, start + len);
}
