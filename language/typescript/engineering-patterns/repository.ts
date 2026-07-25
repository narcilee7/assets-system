/**
 * 手写 Repository 模式
 *
 * 考点：
 * - 抽象数据访问层。
 * - 内存实现方便测试。
 */

export interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
  findAll(): Promise<T[]>;
}

export interface Entity<ID> {
  id: ID;
}

export class InMemoryRepository<T extends Entity<ID>, ID> implements Repository<T, ID> {
  private store = new Map<ID, T>();

  async findById(id: ID): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async save(entity: T): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async delete(id: ID): Promise<void> {
    this.store.delete(id);
  }

  async findAll(): Promise<T[]> {
    return [...this.store.values()];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  interface User extends Entity<number> {
    name: string;
  }

  async function demo() {
    const repo = new InMemoryRepository<User, number>();
    await repo.save({ id: 1, name: "Ada" });
    console.log(await repo.findById(1));
  }
  demo();
}
