/**
 * 手写 mini ORM
 *
 * 考点：
 * - Model 定义、Query Builder、CRUD。
 * - 内存存储实现。
 */

export class Model<T extends Record<string, unknown>> {
  private rows: T[] = [];

  constructor(private name: string) {}

  insert(row: T): void {
    this.rows.push(row);
  }

  findAll(): T[] {
    return [...this.rows];
  }

  query(): Query<T> {
    return new Query(this.rows);
  }
}

export class Query<T extends Record<string, unknown>> {
  private filters: Array<(row: T) => boolean> = [];
  private _limit?: number;
  private _orderBy?: { key: keyof T; desc: boolean };

  where(predicate: (row: T) => boolean): this {
    this.filters.push(predicate);
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  orderBy(key: keyof T, desc = false): this {
    this._orderBy = { key, desc };
    return this;
  }

  execute(): T[] {
    let result = this.rows.filter((row) => this.filters.every((f) => f(row)));
    if (this._orderBy) {
      result = result.sort((a, b) => {
        const av = a[this._orderBy!.key];
        const bv = b[this._orderBy!.key];
        const sign = this._orderBy!.desc ? -1 : 1;
        return av < bv ? -1 * sign : av > bv ? 1 * sign : 0;
      });
    }
    if (this._limit !== undefined) {
      result = result.slice(0, this._limit);
    }
    return result;
  }

  constructor(private rows: T[]) {}
}

if (import.meta.url === `file://${process.argv[1]}`) {
  interface User {
    id: number;
    name: string;
    age: number;
  }
  const users = new Model<User>("users");
  users.insert({ id: 1, name: "Ada", age: 30 });
  users.insert({ id: 2, name: "Bob", age: 25 });
  console.log(users.query().where((u) => u.age >= 30).execute());
}
