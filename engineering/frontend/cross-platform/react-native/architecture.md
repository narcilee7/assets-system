# React Native 架构演进

## 1. 经典架构（Bridge）

### 1.1 核心问题

React Native 的经典架构基于 **Bridge** 连接 JavaScript 线程和 Native 线程：

```
JS Thread          Bridge (JSON)          Native Thread
   │                    │                        │
   │  setNativeProps    │  序列化 JSON           │
   │───────────────────>│───────────────────────>│
   │                    │                        │  Yoga 布局
   │                    │                        │  Native View 渲染
   │                    │  回调 JSON             │
   │<───────────────────│<───────────────────────│
```

**瓶颈**：
- **序列化开销**：所有数据通过 JSON 串行传输，大列表滑动时频繁通信。
- **异步壁垒**：JS 无法同步读取 Native 状态（如 TextInput 光标位置）。
- **单线程 JS**：所有 JS 逻辑跑在一个线程，复杂计算阻塞 UI。

### 1.2 简化版 Bridge 实现

```javascript
// 简化版 MessageQueue
class Bridge {
  constructor() {
    this._queue = [];
    this._callbacks = new Map();
    this._callbackID = 0;
  }

  // JS 调用 Native 模块
  callNative(module, method, args, onSuccess, onFail) {
    const cbID = ++this._callbackID;
    this._callbacks.set(cbID, { onSuccess, onFail });
    this._queue.push({
      type: 'native',
      module,
      method,
      args: JSON.stringify(args),  // 必须序列化
      callbackID: cbID,
    });
    this._flush();
  }

  // Native 调用 JS 回调
  invokeCallback(cbID, result) {
    const cb = this._callbacks.get(cbID);
    if (cb) {
      cb.onSuccess(result);
      this._callbacks.delete(cbID);
    }
  }

  _flush() {
    if (this._queue.length === 0) return;
    const batch = this._queue.splice(0);
    // 通过 WebView.postMessage / JavaScriptInterface 发送到 Native
    NativeBridge.receiveBatch(JSON.stringify(batch));
  }
}
```

## 2. 新架构（JSI + TurboModule + Fabric）

### 2.1 JSI（JavaScript Interface）

JSI 是 C++ 层提供的轻量级 API，让 JS 引擎（Hermes/JSC）直接持有 C++ 对象引用：

```cpp
// C++ HostObject
class NativeModuleHostObject : public jsi::HostObject {
public:
  jsi::Value get(jsi::Runtime&, const jsi::PropNameID& name) override {
    if (name.utf8(rt) == "add") {
      return jsi::Function::createFromHostFunction(
        rt, name, 2,
        [](jsi::Runtime& rt, const jsi::Value& thisVal,
           const jsi::Value* args, size_t count) -> jsi::Value {
          double a = args[0].asNumber();
          double b = args[1].asNumber();
          return jsi::Value(a + b);  // 同步调用，无 JSON 序列化
        }
      );
    }
  }
};
```

**关键突破**：
- **同步调用**：JS 可以直接调用 C++ 方法，无需异步消息队列。
- **共享内存**：JS 和 C++ 共享同一个 Heap（通过 HostObject），避免拷贝。
- **类型安全**：C++ 层可以直接操作 JS 对象（`jsi::Object`、`jsi::Array`）。

### 2.2 TurboModule

TurboModule 是 JSI 之上的原生模块系统，特点：
- **懒加载**：Native 模块按需初始化，冷启动更快。
- **类型安全**：通过 Codegen 从 TypeScript 接口生成 C++ 绑定。
- **同步/异步混合**：支持 `Promise` 和同步返回值。

```typescript
// TurboModule 接口定义
export interface Spec extends TurboModule {
  // 同步方法
  getConstants(): Constants;
  // 异步方法
  add(a: number, b: number): Promise<number>;
}
```

### 2.3 Fabric

Fabric 是新的渲染层，替代 Yoga + Native ViewManager：
- **C++ Shadow Tree**：布局计算在 C++ 线程完成，减少 JS Bridge 通信。
- **优先级调度**：高优先级更新（如手势）可以插队渲染。
- **View Flattening**：自动合并纯容器 View，减少 Native View 层级。

```
JS Thread          C++ (Fabric)           Native UI Thread
   │                    │                         │
   │  render()          │  Yoga Layout            │
   │───────────────────>│────────────────────────>│
   │                    │  (Shadow Tree)          │  View 创建/更新
   │                    │                         │
   │  同步读取布局       │                         │
   │<───────────────────│                         │
```

## 3. 演进对比

| 维度 | 经典架构 | 新架构 |
|------|----------|--------|
| 通信方式 | JSON Bridge（异步） | JSI HostObject（同步+异步） |
| 布局计算 | JS + Yoga（跨线程） | C++ Shadow Tree（同线程） |
| 模块加载 | 启动时全量注册 | 懒加载（TurboModule） |
| 类型安全 | 运行时检查 | 编译期 Codegen 生成 |
| 启动性能 | 慢（需初始化大量模块） | 快（按需加载） |
| 兼容性 | 稳定，生态成熟 | 逐步推进，部分库不兼容 |

## 4. 手写训练：测量 Bridge 延迟

```javascript
// 测量 Bridge 往返延迟
const start = performance.now();
NativeModules.BridgeTestModule.echo('ping', () => {
  const latency = performance.now() - start;
  console.log(`Bridge RTT: ${latency}ms`);  // 典型值 1-5ms
});
```

**思考题**：
- 为什么 FlatList 的 `getItemLayout` 能显著提升性能？（避免 Bridge 通信测量高度）
- `useNativeDriver: true` 的动画为什么流畅？（动画在 Native 线程执行，不经过 Bridge）
