# React手写题

这是近两年中高级 React 面试最常见的一类：**不是实现 Fiber、Hooks，而是考察 React 工程能力**。

基本可以分成几个等级。

---

# Level 1：基础组件（初级必考）

## 1. Tabs

```tsx
<Tabs>
  <Tab title="A">AAA</Tab>
  <Tab title="B">BBB</Tab>
</Tabs>
```

考察

* useState
* children
* React.Children
* cloneElement

---

## 2. Modal

要求

* Portal
* ESC关闭
* 点击遮罩关闭
* body scroll lock

考察

```tsx
createPortal()

useEffect()

EventListener
```

---

## 3. Toast

```tsx
toast.success("Saved")
```

要求

* 多个Toast
* 自动消失
* Queue

考察

* Context
* Portal
* State管理

---

## 4. Accordion

```tsx
<Accordion />
```

要求

* 单开
* 多开

---

## 5. Collapse

高度动画。

一般要求

```
max-height
scrollHeight
transition
```

---

# Level 2：Hooks

这是最多的。

---

## useDebounce

```tsx
const value = useDebounce(input,500)
```

考察

```
setTimeout

cleanup
```

---

## useThrottle

比较经典。

---

## usePrevious

```tsx
const prev = usePrevious(value)
```

考察

```
useRef

useEffect
```

---

## useLatest

```tsx
const latest = useLatest(fn)
```

React 18以后非常经典。

---

## useUnmount

```tsx
useUnmount(()=>{
})
```

---

## useMount

---

## useBoolean

```tsx
const {
 value,
 setTrue,
 setFalse,
 toggle
}
```

---

## useInterval

Dan Abramov经典面试题。

需要解决

```
stale closure
```

---

## useTimeout

---

## useClickOutside

```tsx
const ref = useClickOutside(...)
```

DOM监听。

---

## useLocalStorage

```tsx
const [v,setV]=useLocalStorage(...)
```

需要同步Storage。

---

## useEventListener

封装DOM Event。

---

# Level 3：状态管理

---

## 手写 Redux

不是全部。

一般实现

```
createStore

dispatch

subscribe

getState
```

几十行。

---

## useReducer实现状态机

例如Todo。

---

## Context Provider

实现

```
ThemeProvider

UserProvider
```

---

# Level 4：业务组件（非常高频）

---

## Infinite Scroll

要求

```
IntersectionObserver
```

或者

```
scroll事件
```

---

## Virtual List

这是大厂很喜欢。

要求

100000条数据不卡。

考察

```
visible range

padding

translateY
```

---

## Image Lazy Load

IntersectionObserver。

---

## Search Suggestion

要求

```
Debounce

AbortController

loading

error
```

---

## Upload

要求

```
multiple

progress

cancel

retry
```

---

## Table

一般要求

```
sort

filter

pagination
```

---

## Tree

要求

```
递归

展开

选中
```

---

# Level 5：React能力

这是近几年越来越喜欢问。

---

## Form

自己写一个

```tsx
<Form>
```

支持

```
register

validate

submit
```

有点React Hook Form。

---

## useForm

经典。

---

## Compound Component

例如

```tsx
<Select>

<Select.Option/>

</Select>
```

考察

```
Context

cloneElement
```

---

## Controlled / Uncontrolled

例如

```
<Input
 value
 defaultValue
/>
```

实现双模式。

---

## Render Props

例如

```tsx
<DataProvider>

{data=>...}

</DataProvider>
```

---

## HOC

实现

```tsx
withLoading(Component)
```

---

# Level 6：性能

---

## memo

什么时候更新。

---

## useMemo

缓存。

---

## useCallback

避免子组件Render。

---

## Context优化

避免所有Consumer更新。

---

## React Query缓存思想

不要求实现全部。

理解

```
cache

stale

invalidate
```

---

# 大厂（字节、阿里、腾讯、Kimi、MiniMax）近两年最常出现的手写题

如果按出现频率排序，大致如下：

| 排名    | 题目                            | 难度   | 高频考点                     |
| ----- | ----------------------------- | ---- | ------------------------ |
| ⭐⭐⭐⭐⭐ | useDebounce                   | ★    | Timer、cleanup            |
| ⭐⭐⭐⭐⭐ | useThrottle                   | ★★   | 时间窗口控制                   |
| ⭐⭐⭐⭐⭐ | usePrevious                   | ★    | useRef、effect            |
| ⭐⭐⭐⭐⭐ | Modal                         | ★★   | Portal、事件管理              |
| ⭐⭐⭐⭐⭐ | useClickOutside               | ★★   | DOM Event、ref            |
| ⭐⭐⭐⭐⭐ | Infinite Scroll               | ★★★  | IntersectionObserver     |
| ⭐⭐⭐⭐☆ | Virtual List                  | ★★★★ | 可视区域计算、滚动性能              |
| ⭐⭐⭐⭐☆ | Toast                         | ★★★  | Context、Portal、队列        |
| ⭐⭐⭐⭐☆ | Search Suggestion             | ★★★  | Debounce、AbortController |
| ⭐⭐⭐⭐☆ | Controlled/Uncontrolled Input | ★★★  | 状态同步                     |
| ⭐⭐⭐⭐☆ | Compound Component            | ★★★  | Context、组合模式             |
| ⭐⭐⭐☆☆ | useInterval                   | ★★★  | stale closure            |
| ⭐⭐⭐☆☆ | useLocalStorage               | ★★   | 持久化、同步                   |
| ⭐⭐⭐☆☆ | Redux Mini                    | ★★★  | Store、订阅机制               |
