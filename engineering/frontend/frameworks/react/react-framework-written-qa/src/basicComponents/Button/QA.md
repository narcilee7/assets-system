# Button设计

## asChild怎么实现

哈哈，你说的是 **`asChild`**。这个确实是近几年 React 组件设计里最经典的技巧，也是很多大厂会问的。

它最早是 Radix UI 推广的，shadcn/ui 基本全部组件都在用。

---

## 为什么需要 `asChild`？

假设我们有一个 Button：

```tsx
<Button>
  Save
</Button>
```

内部实现：

```tsx
return <button>{children}</button>;
```

没问题。

但是有一天产品说：

> 这个 Button 要跳转页面。

你自然会写：

```tsx
<Button>
  <a href="/docs">Docs</a>
</Button>
```

结果生成：

```html
<button>
    <a href="/docs">Docs</a>
</button>
```

这是**非法 HTML**。

或者 Next.js：

```tsx
<Button>
    <Link href="/about">
        About
    </Link>
</Button>
```

变成

```html
<button>
    <a>About</a>
</button>
```

也是不对的。

---

## 那怎么办？

Button 其实不一定要渲染 `<button>`。

可以让**孩子自己成为最终元素**。

于是 API 变成：

```tsx
<Button asChild>
    <a href="/docs">
        Docs
    </a>
</Button>
```

最终渲染：

```html
<a
    class="button..."
    href="/docs"
>
    Docs
</a>
```

注意：

**没有 button 了！**

只是把 Button 的样式和行为"附着"到了 `<a>` 上。

---

# 怎么实现？

核心只有一句：

> **把 props 注入到 child，而不是创建新的 DOM。**

React 提供了一个 API：

```tsx
React.cloneElement()
```

例如

原来

```tsx
<Button asChild>
    <a href="/">Home</a>
</Button>
```

children 是：

```tsx
<a href="/">Home</a>
```

我们可以：

```tsx
cloneElement(children, {
    className: "...",
})
```

得到

```tsx
<a
    href="/"
    className="..."
>
    Home
</a>
```

是不是已经完成了？

---

## 一个简单版本

```tsx
import { cloneElement, isValidElement } from "react";

if (asChild) {
    if (!isValidElement(children)) {
        throw new Error("Button asChild expects a single React element");
    }

    return cloneElement(children, {
        className: cn(
            base,
            variants[variant],
            children.props.className,
        ),
    });
}

return (
    <button>
        {children}
    </button>
);
```

原理非常简单。

---

## 但是……

如果只有 className，那太简单了。

真正的问题来了。

Button 还有：

```tsx
disabled

onClick

ref

aria-*

tabIndex

style

...
```

都怎么办？

如果直接：

```tsx
cloneElement(child, {
    className,
})
```

child 自己的

```tsx
<a
    onClick={...}
```

是不是丢了？

---

所以需要 Merge。

例如

```tsx
cloneElement(child, {
    className: cn(
        child.props.className,
        className,
    ),

    onClick: compose(
        child.props.onClick,
        onClick,
    ),
})
```

所有 Props 都要 Merge。

---

## 还有 Ref

最麻烦的是

```tsx
<Button
    ref={buttonRef}
    asChild
>
```

现在 Button 已经没有 button 了。

ref 应该指向

```tsx
<a>
```

怎么办？

React 没有自动 Merge Ref。

于是 Radix 写了：

```tsx
composeRefs()
```

把

```text
Button 的 ref

+

child 的 ref
```

合并。

---

## 所以 Radix 干脆抽了一个组件

叫

```tsx
<Slot />
```

Button 就变成：

```tsx
const Comp = asChild
    ? Slot
    : "button";

return (
    <Comp
        className={...}
        {...props}
    />
);
```

是不是很优雅？

---

## Slot 在干什么？

可以理解成

```text
<Button>

↓

Slot

↓

cloneElement

↓

Merge Props

↓

Merge Ref

↓

Render Child
```

所以 Slot 基本就是

```text
cloneElement++

```

是 cloneElement 的增强版。

---

## 面试怎么回答？

如果面试官问：

> asChild 是怎么实现的？

你可以回答：

> `asChild` 的核心思想是**组件不渲染自己的 DOM，而是把自己的 props 注入到唯一的子元素中**。React 可以通过 `cloneElement` 实现这一点，将 `className`、事件、ARIA 属性等合并到子元素上，从而避免出现 `<button><a></a></button>` 这种非法嵌套。在实际生产中，仅使用 `cloneElement` 不够，还需要处理 `className`、事件、`style`、`ref` 等属性的合并，因此 Radix UI 将这部分逻辑封装成了 `Slot` 组件，`asChild` 本质上就是在 `button` 和 `Slot` 两种渲染方式之间切换。

---

**我更推荐下一步我们亲手实现一个简化版 `Slot`（约 40 行代码）**。实现完以后，你就会发现 shadcn/ui 几乎所有组件（Button、Dialog、Tooltip、DropdownMenu 等）都在复用这一套机制。
