import type { PickByValue } from "./impl";

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

// --- 测试用例 ---

// 1. 基本选取
type Obj1 = { a: string; b: number; c: string };
type Case1 = PickByValue<Obj1, string>;
type Test1 = AssertEqual<Case1, { a: string; c: string }>;
const _t1: Test1 = true;

// 2. 选取 number
type Case2 = PickByValue<Obj1, number>;
type Test2 = AssertEqual<Case2, { b: number }>;
const _t2: Test2 = true;

// 3. 无可匹配
type Case3 = PickByValue<Obj1, boolean>;
type Test3 = AssertEqual<Case3, {}>;
const _t3: Test3 = true;

// 4. 联合类型值：string | number 同时 extends string 和 number 吗？
// 注意：分配律下 string | number extends string 不成立（整体不成立）
type Obj2 = { a: string; b: number; c: string | number };
type Case4 = PickByValue<Obj2, string>;
type Test4 = AssertEqual<Case4, { a: string }>;
const _t4: Test4 = true;

// 5. 包含可选属性（值类型为 string | undefined）
type Obj3 = { a: string; b?: string };
type Case5 = PickByValue<Obj3, string>;
// b 的值类型是 string | undefined，不能严格 extends string
type Test5 = AssertEqual<Case5, { a: string }>;
const _t5: Test5 = true;

export {};
