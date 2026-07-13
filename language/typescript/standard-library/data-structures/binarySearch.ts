/**
 * 手写二分查找
 *
 * 考点：
 * - 左闭右开 / 左闭右闭区间。
 * - lower_bound / upper_bound。
 */

export function binarySearch<T>(arr: T[], target: T): number {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

export function lowerBound<T>(arr: T[], target: T): number {
  let left = 0;
  let right = arr.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] < target) left = mid + 1;
    else right = mid;
  }
  return left;
}

export function upperBound<T>(arr: T[], target: T): number {
  let left = 0;
  let right = arr.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] <= target) left = mid + 1;
    else right = mid;
  }
  return left;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arr = [1, 3, 5, 7, 9];
  console.log(binarySearch(arr, 5)); // 2
  console.log(lowerBound(arr, 6));   // 3
  console.log(upperBound(arr, 5));   // 3
}
