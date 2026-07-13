/**
 * 手写 debounce
 *
 * 考点：
 * - 延迟执行，高频调用只触发最后一次。
 * - leading / trailing 选项。
 * - 支持 AbortSignal 取消。
 */

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean; signal?: AbortSignal } = {}
): (...args: Parameters<T>) => void {
  const { leading = false, trailing = true, signal } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = () => {
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };

  signal?.addEventListener("abort", () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  });

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    lastArgs = args;

    const isLeading = leading && !timer;
    if (isLeading) fn(...args);

    timer = setTimeout(() => {
      timer = null;
      if (trailing && !(leading && lastArgs === args)) {
        invoke();
      }
    }, wait);
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fn = debounce((x: number) => console.log(x), 100, { trailing: true });
  fn(1);
  fn(2);
  fn(3);
}
