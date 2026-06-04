# Review

## 我一开始容易写错什么

1. **Map 中 listener 的类型不匹配**：`on` 的 `listener` 是 `(payload: Events[K]) => void`，但 Map 中存储的是 `(payload: Events[keyof Events]) => void`，需要对 Map 的 add/delete 做类型断言。
2. **once 的 off 引用**：一开始在 `once` 里直接 `this.off(event, listener)`，这会移除失败，因为 listener 和 wrapper 不是同一个函数引用。需要先 on(wrapper)，再在 wrapper 内部 off(wrapper)。
3. **emit 时监听器抛错**：没有 try/catch 包裹，导致一个监听器抛错会阻塞后续监听器。

## 这个实现为什么成立

- 通过泛型约束 `K extends keyof Events`，在编译期保证了事件名和载荷类型的一致性。
- 返回 unsubscribe 函数符合 React useEffect 和 modern 事件库的习惯。
- `once` 利用闭包包装原始 listener，保证正确移除。

## 和标准库 / 框架实现的差距

- Node 的 `EventEmitter` 是运行时动态字符串，无类型安全。
- mitt 是一个非常轻量的事件库，但 payload 类型是 `any`，需要手动维护类型映射。
- rxjs 的 `Subject` 提供了更强大的流操作能力，但学习曲线更高。

## 工程里怎么取舍

- 在严格类型优先的项目中，TypedEventEmitter 提供零成本的编译期保障。
- 如果项目需要跨窗口/iframe 通信（如 BroadcastChannel），可以在 emit 层做序列化/反序列化，上层仍保持类型安全。
- 对于高频emit场景（如鼠标移动），考虑用 rxjs 替代，利用背压和节流操作符优化性能。

## 下次复习重点

1. 手写 `once` 时注意 wrapper 函数的自引用移除。
2. 思考如何实现 `emitSync` 和 `emitAsync`（后者按顺序 await 每个监听器）。
3. 对比 mitt 和 TypedEventEmitter 的 API 差异，思考如何在 mitt 基础上加类型层。
