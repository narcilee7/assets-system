# Angular 变更检测

## 1. Zone.js：自动检测的基石

Angular 默认使用 **Zone.js** 拦截所有异步操作，自动触发变更检测：

```javascript
// Zone.js 拦截的异步 API：setTimeout、Promise、XHR、EventListener 等
const originalSetTimeout = window.setTimeout;
window.setTimeout = function(callback, delay) {
  return originalSetTimeout(() => {
    Zone.current.run(() => {
      callback();
      // Angular Zone 自动触发变更检测
    });
  }, delay);
};
```

## 2. 变更检测策略

### Default
每次 Zone 触发，从根组件递归检查所有子组件。

### OnPush

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnPushComponent {
  @Input() data: Item[];
}
```

只在以下情况检查：
1. `@Input` 引用变化
2. 组件内部事件触发
3. 手动调用 `markForCheck()`
4. async pipe 触发

## 3. OnPush 最佳实践

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListComponent {
  @Input() users: User[];

  // ❌ 引用不变，OnPush 检测不到
  onUpdate(user: User) {
    this.users[0] = { ...user, name: 'New' };
  }

  // ✅ 创建新数组
  onUpdate(user: User) {
    this.users = this.users.map(u =>
      u.id === user.id ? { ...u, name: 'New' } : u
    );
  }
}
```

## 4. 手动控制变更检测

```typescript
export class ManualComponent {
  constructor(private cd: ChangeDetectorRef, private zone: NgZone) {}

  refresh() { this.cd.markForCheck(); }     // 标记待检查
  detectNow() { this.cd.detectChanges(); }  // 立即检查

  runOutsideAngular() {
    this.zone.runOutsideAngular(() => {
      // 这里的异步操作不会触发变更检测
      setInterval(() => this.heavyComputation(), 100);
    });
  }
}
```
