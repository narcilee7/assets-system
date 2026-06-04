/**
 * UnionToIntersection - 将联合类型转为交叉类型
 *
 * 利用函数参数位置的逆变特性：
 * (x: A) => void & (x: B) => void  等价于  (x: A & B) => void
 */

export type UnionToIntersection<T> = [T] extends [never]
  ? never
  : (T extends any ? (x: T) => void : never) extends (x: infer U) => void
  ? U
  : never;
