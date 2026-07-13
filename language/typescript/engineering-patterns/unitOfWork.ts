/**
 * 手写 Unit of Work
 *
 * 考点：
 * - 聚合多个操作，统一提交/回滚。
 * - 用 async/await 表达事务边界。
 */

export class UnitOfWork {
  private actions: Array<() => Promise<void> | void> = [];
  private rollbacks: Array<() => Promise<void> | void> = [];

  register(
    action: () => Promise<void> | void,
    rollback: () => Promise<void> | void
  ): void {
    this.actions.push(action);
    this.rollbacks.unshift(rollback);
  }

  async commit(): Promise<void> {
    try {
      for (const action of this.actions) await action();
      this.actions = [];
      this.rollbacks = [];
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async rollback(): Promise<void> {
    for (const rollback of this.rollbacks) {
      try {
        await rollback();
      } catch {
        // ignore rollback errors
      }
    }
    this.actions = [];
    this.rollbacks = [];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    const uow = new UnitOfWork();
    const state: string[] = [];

    uow.register(
      () => state.push("action1"),
      () => state.pop()
    );
    uow.register(
      () => {
        throw new Error("fail");
      },
      () => state.pop()
    );

    try {
      await uow.commit();
    } catch {
      console.log("rolled back:", state);
    }
  }
  demo();
}
