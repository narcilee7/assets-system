# Angular Signals

## 1. 为什么引入 Signals

Zone.js 的问题：
- 需要猴子补丁，侵入性强
- 无法 tree-shake
- 变更检测粒度粗（整个组件树）
- 调试困难

Signals = **细粒度的响应式原语**，明确追踪依赖关系。

## 2. Signal API

```typescript
import { signal, computed, effect } from '@angular/core';

const count = signal(0);
console.log(count());  // 读取: 0

count.set(1);          // 直接设置
count.update(c => c + 1);  // 基于前值更新

const doubled = computed(() => count() * 2);

const dispose = effect(() => {
  console.log('count is:', count());
});
dispose();  // 清理
```

## 3. 与 RxJS 互操作

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// RxJS -> Signal
const data$ = http.get('/api/data');
const data = toSignal(data$, { initialValue: [] });

// Signal -> RxJS
const count$ = toObservable(count);
count$.pipe(debounceTime(300)).subscribe(console.log);
```

## 4. Signal 组件

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <p>Count: {{ count() }}</p>
    <p>Doubled: {{ doubled() }}</p>
    <button (click)="increment()">+</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounterComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update(c => c + 1);
    // 只有 count() 和 doubled() 的订阅者需要更新
    // 不需要 Zone.js，不需要遍历整个组件树
  }
}
```

## 5. Signal vs RxJS

| 特性 | Signal | RxJS |
|------|--------|------|
| 同步/异步 | 同步 | 同步 + 异步 |
| 多值流 | 当前值 | 无限流 |
| 组合操作 | computed | 丰富操作符 |
| 适用场景 | UI 状态、简单派生 | 复杂异步流、事件处理 |

**迁移建议**：组件内部状态 → Signal；HTTP/WebSocket → RxJS；两者可共存。
