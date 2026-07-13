/**
 * 手写 new / instanceof / Object.create
 *
 * 考点：
 * - 原型链：`__proto__` 指向构造函数的 `prototype`。
 * - `new` 运算符的执行步骤。
 * - `instanceof` 沿原型链查找。
 */

export function myNew<T>(ctor: new (...args: unknown[]) => T, ...args: unknown[]): T {
  const instance = Object.create(ctor.prototype);
  const result = ctor.apply(instance, args);
  return (result !== null && (typeof result === "object" || typeof result === "function"))
    ? (result as T)
    : instance;
}

export function myInstanceOf(left: unknown, right: Function): boolean {
  if (left === null || typeof left !== "object") return false;
  let proto = Object.getPrototypeOf(left);
  while (proto) {
    if (proto === right.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

export function myCreate(proto: object | null): object {
  function F() {}
  F.prototype = proto;
  return new (F as unknown as new () => object)();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  function Person(this: { name: string }, name: string) {
    this.name = name;
  }
  const p = myNew(Person as unknown as new (name: string) => unknown, "Ada");
  console.log((p as { name: string }).name);
  console.log(myInstanceOf(p, Person));
}
