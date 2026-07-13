# TypeScript 类型系统面试主轴

## 1. 结构类型 vs 名义类型

TypeScript 采用结构类型：只要形状相同即可赋值，不依赖显式声明的继承关系。

```ts
interface Dog {
  name: string;
}
class Cat {
  name: string = "";
}
const dog: Dog = new Cat(); // OK，结构相同
```

Java、C# 是名义类型：类型等价必须显式声明。

## 2. 类型擦除

TS 编译后类型信息被擦除，运行时无法直接拿到泛型参数。

```ts
function id<T>(x: T): T { return x; }
// 编译后：function id(x) { return x; }
```

运行时类型检查需要类型守卫、断言函数或运行时 schema。

## 3. 协变、逆变、双变、不变

| 关系 | 说明 | 例子 |
|------|------|------|
| 协变 | 子类型可以向上赋值 | `Cat[]` ≼ `Animal[]` |
| 逆变 | 参数方向相反 | `(x: Animal) => void` ≼ `(x: Cat) => void` |
| 双变 | 既协变又逆变 | 旧 TS 的函数参数 |
| 不变 | 必须完全相同 | `ArrayBuffer`、含 `private` 字段的类 |

```ts
let animalHandler: (x: Animal) => void;
let catHandler: (x: Cat) => void;

animalHandler = catHandler; // 错误：参数是逆变的
catHandler = animalHandler; // OK
```

## 4. 条件类型与分配律

```ts
type IsArray<T> = T extends Array<any> ? true : false;
```

分配律：裸类型参数在 `extends` 左侧会自动分配到联合类型。

```ts
type ToArray<T> = T extends any ? T[] : never;
type A = ToArray<string | number>; // string[] | number[]
```

阻止分配：用 `[T] extends [any]` 包裹。

```ts
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type B = ToArrayNonDist<string | number>; // (string | number)[]
```

## 5. `infer` 的使用场景

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type Params<T> = T extends (...args: infer P) => any ? P : never;
```

## 6. `interface` 与 `type` 的区别

| 特性 | interface | type |
|------|-----------|------|
| 合并声明 | 支持同名合并 | 不支持 |
| 继承 | `extends` | 用 `&` |
| 映射类型、条件类型 | 不支持直接写 | 支持 |
| 性能 | 通常更快（可声明合并） | 复杂类型会展开 |

工程建议：对象形状优先 `interface`，工具类型/联合类型用 `type`。

## 7. 类型收窄

- `typeof`、`instanceof`、`in`
- 自定义类型守卫：`x is Type`
- 断言函数：`asserts x is Type`
- 判别联合类型：`type Action = { type: "inc" } | { type: "dec" }`

## 8. 泛型约束与默认值

```ts
function getLength<T extends { length: number }>(x: T, defaultLen = 0): number {
  return x.length ?? defaultLen;
}
```

## 9. 常见类型体操

```ts
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;
```

## 10. `strict` 模式里哪些开关最重要？

- `strictNullChecks`：避免 null/undefined 漏洞。
- `noImplicitAny`：禁止隐式 any。
- `strictFunctionTypes`：函数参数逆变检查。
- `noUncheckedIndexedAccess`：索引访问返回 `T | undefined`。
