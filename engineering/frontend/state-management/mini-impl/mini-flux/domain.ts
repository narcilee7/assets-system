import { AppDispatcher } from "./dispatcher.js";
import { BaseStore } from "./store.js";

// 运用 TS 的联合类型确保 Action 绝对安全
export type CounterAction =
  | { type: 'COUNTER_INCREMENT'; payload: number }
  | { type: 'COUNTER_DECREMENT'; payload: number }
  | { type: 'COUNTER_RESET' };


interface CounterState {
  count: number;
  lastUpdated: Date;
}

class CounterStore extends BaseStore<CounterState> {
  constructor() {
    super({ count: 0, lastUpdated: new Date() });

    AppDispatcher.register(a => this.handleAction(a));
  }

  /**
   * handleAction
   */
  public handleAction(action: CounterAction): void {
    switch (action.type) {
      case 'COUNTER_INCREMENT':
        this._state = {
          count: this._state.count + action.payload,
          lastUpdated: new Date(),
        };
        this.emitChange(); // 状态变了，通知视图
        break;

      case 'COUNTER_DECREMENT':
        this._state = {
          count: this._state.count - action.payload,
          lastUpdated: new Date(),
        };
        this.emitChange();
        break;

      case 'COUNTER_RESET':
        this._state = { count: 0, lastUpdated: new Date() };
        this.emitChange();
        break;

      default:
        // 遇到非当前 Store 关心的 Action，静默忽略
        break;
    }
  }
}

export const counterStore = new CounterStore();
