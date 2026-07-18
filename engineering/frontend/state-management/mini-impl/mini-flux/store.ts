import type { Action, DispatcherCallback } from './interface.js'

export abstract class BaseStore<TState> {
  protected _state: TState;
  private _listeners: Set<() => void> = new Set();

  constructor(state: TState) {
    this._state = state;
  }

  public getState(): TState {
    return this._state;
  }

  public subscribe(l: () => void): () => void {
    this._listeners.add(l);
    return () => {
      this._listeners.delete(l);
    }
  }

  protected emitChange(): void {
    this._listeners.forEach(l => l());
  }

  // broadcast action
  abstract handleAction(a: Action): void;
}
