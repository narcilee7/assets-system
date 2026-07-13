# Nodejs Eventloop

```
JavaScript
        │
        ▼
Node Runtime
        │
        ▼
libuv
        │
        ▼
epoll
        │
        ▼
Linux Kernel
```

## 为什么JS会有EventLoop

JavaScript 为什么需要 Event Loop？

很多人的回答是：

> 因为 JavaScript 是单线程。

这是结果，不是原因。

真正的问题应该是：

> 如果没有 Event Loop，Node.js 会发生什么？

### 假设没有EventLoop

```js
const fs = require("fs");

const data = fs.readFileSync("a.txt");
```

```text
main()
    │
    ▼
readFileSync()
    │
    ▼
Kernel
    │
    ▼
返回数据
    │
    ▼
console.log()
    │
    ▼
退出
```

CPU的执行模型就是：`Call Stack`

### 异步呢？

```js
fs.readFile('a.txt', (err, data) => {
  console.log(data.toString())
})
```
问题来了。

`fs.readFile()`

马上返回，于是主线程继续，那么file还没读完callback怎么办？

如果程序：直接退出。Callback：永远：不会执行。

所以：必须有一个东西：

在：main()

结束以后

继续活着

不断等待：

新的事件

这个东西：

就是：

Event Loop。

## EventLoop的本质

Event Loop就是Runtime的主循环 (Main Loop)

```cpp
int main() {
  run_js();

  while (process_is_alive()) {
    uv_run(loop);
  }
}
```

```text
执行 JavaScript

↓

JavaScript 执行完

↓

Runtime 不退出

↓

继续处理事件
```

所以Node.js是真正的入口，不是你的`index.js`

## 为什么浏览器也有EventLoop

浏览器也是
```text
执行 Script

↓

等待事件

↓

处理事件

↓

继续等待
```

Node只是时间变成了：`TCP` -> `Timer` -> `File` -> `Signal`

浏览器变成了：`Mouse` -> `Keyboard` -> `DOM` -> `Network`

Event Loop 不是 Node 发明的。而是一种Runtime模型。

## EventLoop真正负责什么？

V8负责JavaScript，EventLoop负责人什么时候再进入js

```js
setTimeout(() => { console.log("timer") }, 1000)
```

1. JavaScript 调用 setTimeout()。
2. V8 执行这段同步代码。
3. Node 把 Timer 注册到 libuv。
4. 主线程继续执行后面的同步代码。
5. 一秒后，libuv 发现 Timer 到期。
6. Event Loop 再次进入 V8，执行回调。

**Event Loop 在调度 JavaScript 回调。**

真正执行JavaScript字节码的是：

```
Ignition

TurboFan

V8
```

EventLoop只是决定哪一个callback现在可以执行

## 重新定义Node

```text
             Node.js
─────────────────────────────────
        JavaScript API
               │
               ▼
              V8
               ▲
               │
         Event Loop（调度）
               │
               ▼
             libuv
      │      │      │
   epoll   ThreadPool  Timer
               │
               ▼
         Operating System
```
