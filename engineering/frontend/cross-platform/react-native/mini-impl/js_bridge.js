// const NativeBridge = require("");

class Bridge {
  constructor() {
    this._queue = [];
    this._callbacks = new Map();
    this._callbackID = 0;
  }

  callNative(module, method, args, onSuccess, onFail) {
    const cbID = ++this._callbackID;
    this._callbackID.set(cbID, { onSuccess, onFail });
    this._queue.push({
      type: "natvie",
      module,
      method,
      args: JSON.stringify(args),
      callbackID: cbID,
    });
    // TODO flush
  }

  // Native callback invoked by the native side
  invokeCallback(cbID, result) {
    const cb = this._callbacks.get(cbID);
    if (cb) {
      cb.onSuccess(result);
      this._callbacks.delete(cbID);
    }
  }

  _flush() {
    if (this._queue.length === 0) return;
    const batch = this._queue.slice(0);
    NativeBridge.receiveBatch(batch);
  }
}
