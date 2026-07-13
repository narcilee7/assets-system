# epoll Linux高性能网络的基石

epoll 快，不是因为它用了更高级的数据结构，而是因为它改变了整个工作模式。

## select慢在哪里？

假设

100000 个 Socket真正活跃：5 个

selct每次

```c
for fd in all_fds:
  check(fd);
```

内核

```text
fd1

没数据

fd2

没数据

...

fd99999

没数据
```

最后

`fd100000 有数据`

所以CPU一直检查，真正处理数据：

只占：极少部分。

所以：select 的问题不是系统调用，而是：每次都重新遍历所有 fd。

## epoll 反过来

当：Socket：Ready。

Kernel：自己：记下来。

等：应用：来拿。

是不是：不用：扫描了？

这就是：epoll。

## epoll的核心思想

不要找Ready Socket，而是维护Ready Socket

select:

```text
所有Socket -> scan -> 找到Ready
```

epoll:

```text
Socket Ready -> 加入Ready Queue -> Applcation Get
```

## epoll的API

- epoll_create()
- epoll_ctl()
- epoll_wait()

### `epoll_create()`

直接场景一个`epoll instance`

可以理解成：一个事件管理器。

它不是 Socket。也不是 Thread。

而是：Kernel：维护的一套事件对象。

### `epoll_ctl()`

`epoll_ctl()`关注Socket事件

### `epoll_wait()`

```text
scan ReadyQueue
```

不是应用去找事件。

而是：

事件发生的时候，内核主动记录。

这就是：

事件驱动（Event Driven）。

## 为什么epoll是O(1)?

epoll 不是所有操作都是 O(1)。

更准确地说：

- epoll_ctl()：通常近似 O(1)（内核使用红黑树管理注册的 fd）。
- epoll_wait()：返回事件的成本与就绪事件数相关，通常认为是 O(ready)。

## epoll内部到底维护什么？

1. interest list：Linux内核实现中通常使用红黑树来管理这些注册的fd，便于高效地增删改查
2. Ready List：只保存发生事件的fd

## 为什么Nginx、Redis、Node.js都用epoll？

因为它们都有一个特点：大量连接，真正活跃的很少

