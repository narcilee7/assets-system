/**
 * PickByValue - 从 T 中选取值类型匹配 V 的属性
 */

export type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};
