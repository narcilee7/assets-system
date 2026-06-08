# RxJS 模式

## 1. 核心概念

### Observable

```typescript
import { Observable } from 'rxjs';

const observable = new Observable(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.complete();
});

observable.subscribe({
  next: (value) => console.log(value),  // 1, 2
  complete: () => console.log('done'),
});
```

### Subject

```typescript
import { Subject, BehaviorSubject, ReplaySubject } from 'rxjs';

// Subject：无初始值，新订阅者只接收后续值
const subject = new Subject<number>();

// BehaviorSubject：有初始值，新订阅者立即收到当前值
const behavior = new BehaviorSubject(0);

// ReplaySubject：缓存 N 个值给新订阅者
const replay = new ReplaySubject(2);
```

## 2. 常用操作符

```typescript
import { of, interval } from 'rxjs';
import { map, filter, mergeMap, switchMap, debounceTime, catchError, takeUntil } from 'rxjs/operators';

of(1, 2, 3).pipe(map(x => x * 2));           // 2, 4, 6
of(1, 2, 3, 4).pipe(filter(x => x % 2 === 0)); // 2, 4

// switchMap：取消前一个，适合搜索
searchInput.pipe(
  debounceTime(300),
  switchMap(query => http.get(`/api/search?q=${query}`))
);

// catchError：错误兜底
http.get('/api/data').pipe(
  catchError(err => of({ error: true, data: [] }))
);
```

## 3. Angular 常见模式

### HTTP + Loading

```typescript
export class UserListComponent {
  private loadUsers$ = new BehaviorSubject<void>(undefined);

  users$ = this.loadUsers$.pipe(
    switchMap(() => this.http.get<User[]>('/api/users').pipe(
      startWith(null),
      catchError(err => of({ error: err }))
    ))
  );

  refresh() { this.loadUsers$.next(); }
}
```

### 表单防抖搜索

```typescript
export class SearchComponent {
  searchControl = new FormControl('');

  results$ = this.searchControl.valueChanges.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    filter(query => query.length > 2),
    switchMap(query => this.http.get(`/api/search?q=${query}`)),
    shareReplay(1)
  );
}
```

## 4. 内存管理

```typescript
export class SafeComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Angular 16+ 更简洁
export class ModernComponent {
  constructor() {
    interval(1000).pipe(takeUntilDestroyed()).subscribe();
  }
}
```
