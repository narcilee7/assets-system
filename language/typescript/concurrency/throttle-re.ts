export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options?: { leading?: boolean; trailing?: boolean },
): (...args: Parameters<T>) => void {
  const { leading = false, trailing = false } = options ?? {};
  let lastArgs: Parameters<T> | null;
  let lastInvoke = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const invoke = (args: Parameters<T>) => {
    lastInvoke = performance.now();
    fn(...args);
    lastArgs = null;
  };

  return (...args: Parameters<T>) => {
    const now = performance.now();
    const remaing = delay - (now - lastInvoke);
    if (remaing < 0) {
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
        if (lastArgs) {
          invoke(lastArgs);
        }
      }, remaing);
    }
  };
}
