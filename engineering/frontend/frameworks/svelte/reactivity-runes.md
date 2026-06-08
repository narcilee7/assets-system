# Svelte Runes

## 1. 从 Svelte 4 到 Svelte 5

Svelte 4 的响应式：编译时通过 `let` 和 `$:` 推断。

```svelte
<script>
  let count = 0;              // 编译器自动包装为响应式
  $: doubled = count * 2;     // 编译器分析依赖
</script>
```

Svelte 5 引入 **Runes**：显式的响应式原语。

```svelte
<script>
  let count = $state(0);              // 显式声明响应式状态
  let doubled = $derived(count * 2);  // 显式声明派生值
</script>
```

## 2. Runes API

### $state

```svelte
<script>
  let count = $state(0);

  // 对象和数组自动深度响应式
  let user = $state({ name: 'John', age: 30 });
  user.age = 31;  // 触发更新

  // 类实例也可以
  class Counter {
    count = $state(0);
    increment() {
      this.count++;
    }
  }
  const counter = new Counter();
</script>

<button on:click={() => count++}>
  {count}
</button>
```

### $derived

```svelte
<script>
  let firstName = $state('John');
  let lastName = $state('Doe');

  // 自动追踪依赖
  let fullName = $derived(firstName + ' ' + lastName);

  // 条件依赖也自动处理
  let showFull = $state(true);
  let displayName = $derived(showFull ? fullName : firstName);
</script>
```

### $effect

```svelte
<script>
  let count = $state(0);
  let logged = $state([]);

  $effect(() => {
    // 自动追踪 count，count 变化时执行
    logged = [...logged, count];
  });

  // 带 cleanup
  $effect(() => {
    const interval = setInterval(() => {
      count++;
    }, 1000);

    return () => clearInterval(interval);  // cleanup
  });
</script>
```

### $props

```svelte
<script>
  // 接收 props
  let { name, age = 18 } = $props();

  // 类型（配合 JSDoc 或 TypeScript）
  /** @type {{ name: string, age?: number }} */
  let { name, age = 18 } = $props();
</script>

<p>{name} is {age} years old</p>
```

## 3. Runes vs Vue Reactivity

| 特性 | Svelte Runes | Vue Reactivity |
|------|-------------|----------------|
| 声明方式 | `$state()` 显式 | `ref()` / `reactive()` 显式 |
| 读取 | 直接访问（无 `.value`） | `ref.value` / `reactive` 直接访问 |
| 派生 | `$derived()` | `computed()` |
| 副作用 | `$effect()` | `watch()` / `watchEffect()` |
| 模板中访问 | 直接（编译时处理） | 直接（Proxy 代理） |
| 深度响应 | 自动 | `reactive` 自动，`ref` 需手动 |

## 4. 细粒度更新机制

```svelte
<script>
  let user = $state({
    profile: { name: 'John', age: 30 },
    settings: { theme: 'dark' }
  });
</script>

<!-- 只有 name 变化时，这个 span 会更新 -->
<span>{user.profile.name}</span>

<!-- 只有 theme 变化时，这个 span 会更新 -->
<span>{user.settings.theme}</span>
```

编译器会为每个 `{expression}` 生成独立的更新函数，只更新变化的 DOM 节点。
