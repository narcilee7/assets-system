import type { UnionToIntersection } from "./impl";

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

// --- 测试用例 ---

// 1. 基本联合转交叉
type Case1 = UnionToIntersection<{ a: string } | { b: number }>;
type Test1 = AssertEqual<Case1, { a: string } & { b: number }>;
const _t1: Test1 = true;

// 2. 三元素联合
type Case2 = UnionToIntersection<{ a: string } | { b: number } | { c: boolean }>;
type Test2 = AssertEqual<Case2, { a: string } & { b: number } & { c: boolean }>;
const _t2: Test2 = true;

// 3. 单一类型
type Case3 = UnionToIntersection<{ a: string }>;
type Test3 = AssertEqual<Case3, { a: string }>;
const _t3: Test3 = true;

// 4. never
type Case4 = UnionToIntersection<never>;
type Test4 = AssertEqual<Case4, never>;
const _t4: Test4 = true;

// 5. 重复属性不同类型 -> 交叉后该属性变为 never（string & number = never）
type Case5 = UnionToIntersection<{ a: string } | { a: number }>;
type Expected5 = { a: never };
type Test5 = AssertEqual<Case5, Expected5>;
const _t5: Test5 = true;

export {};
