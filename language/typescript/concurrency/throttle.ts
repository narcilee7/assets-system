/**
 * 手写 throttle
 *
 * 考点：
 * - 固定时间间隔内最多执行一次。
 * - leading / trailing 选项。
 */

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  const { leading = true, trailing = true } = options;
  let lastArgs: Parameters<T> | null = null;
  let lastInvoke = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const invoke = (args: Parameters<T>) => {
    lastInvoke = performance.now();
    fn(...args);
    lastArgs = null;
  };

  return (...args: Parameters<T>) => {
    const now = performance.now();
    const remaining = wait - (now - lastInvoke);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (leading) {
        invoke(args);
      } else {
        lastInvoke = now;
      }
    } else if (trailing && !timer) {
      lastArgs = args;
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs) invoke(lastArgs);
      }, remaining);
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fn = throttle((x: number) => console.log(x), 100);
  fn(1);
  fn(2);
  fn(3);
}
