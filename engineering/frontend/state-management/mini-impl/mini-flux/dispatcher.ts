// import type _interface = require("./interface");
import type { Action, DispatcherCallback } from './interface.js'

class Dispatcher<A extends Action> {
  private _callbacks: Set<DispatcherCallback<A>> = new Set();

  private _isDispaching = false;

  public register(callback: DispatcherCallback<A>): void {
    this._callbacks.add(callback);
  }

  public dispatch(action: A): void {
    if (this._isDispaching) {
      throw new Error("Flux_Error: Cannot dispatch in the middle of a dispatch");
    }
    this._isDispaching = true;
    try {
      this._callbacks.forEach(c => c(action));
    } finally {
      this._isDispaching = false;
    }
  }
}

export const AppDispatcher = new Dispatcher<Action<any, any>>();
