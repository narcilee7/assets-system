import type { DeepReadonly } from "./impl";

// 辅助：类型相等断言
type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

// --- 测试用例 ---

// 1. 基本对象
type Case1 = DeepReadonly<{ a: string; b: number }>;
type Test1 = AssertEqual<Case1, { readonly a: string; readonly b: number }>;
const _t1: Test1 = true;

// 2. 嵌套对象
type Case2 = DeepReadonly<{ user: { name: string; age: number } }>;
type Test2 = AssertEqual<
  Case2,
  { readonly user: { readonly name: string; readonly age: number } }
>;
const _t2: Test2 = true;

// 3. 数组
type Case3 = DeepReadonly<string[]>;
type Test3 = AssertEqual<Case3, ReadonlyArray<string>>;
const _t3: Test3 = true;

// 4. 嵌套数组
type Case4 = DeepReadonly<{ items: number[] }>;
type Test4 = AssertEqual<
  Case4,
  { readonly items: ReadonlyArray<number> }
>;
const _t4: Test4 = true;

// 5. 函数应保持为函数
type Case5 = DeepReadonly<{ fn: () => void }>;
type Test5 = AssertEqual<Case5, { readonly fn: () => void }>;
const _t5: Test5 = true;

// 6. 基本类型透传
type Case6 = DeepReadonly<string>;
type Test6 = AssertEqual<Case6, string>;
const _t6: Test6 = true;

// 编译通过即表示所有类型测试通过
export {};
