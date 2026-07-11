import gc
import sys
from typing import Any, List


def trace_object_life():
    print("=== 1. 验证常规引用计数的即时消亡 ===")
    # 禁用自动 GC，防止对实验产生噪音扰乱
    gc.disable()

    # 诞生
    node: List[Any] = [114, 514]
    node_address = id(node)
    # sys.getrefcount 自身作为入参会产生一次临时引用，因此结果会比实际多 1
    print(
        f"Node 刚诞生。C 级内存物理地址: {node_address}, 真实引用计数: {sys.getrefcount(node) - 1}"
    )

    alias = node
    print(f"建立别名后。真实引用计数: {sys.getrefcount(node) - 1}")

    del alias
    print(f"解除别名后。真实引用计数: {sys.getrefcount(node) - 1}")

    print("\n=== 2. 制造循环引用幽灵 ===")
    a: List[Any] = []
    b: List[Any] = []
    a.append(b)
    b.append(a)

    a_address, b_address = id(a), id(b)
    print(f"循环引用构筑完毕。a_addr: {a_address}, b_addr: {b_address}")
    print(f"此时 a 的引用计数: {sys.getrefcount(a) - 1}")

    # 断开强引用名称
    del a
    del b
    # 此时代码层已经彻底丢失了 a 和 b 的控制句柄，但因为它们的内部互相抱着对方，内存依然在堆区死锁！

    print("\n=== 3. 召唤第二死神：强制触发分代回收 ===")
    # gc.collect() 会返回本次回收成功消灭的孤魂野鬼（死对象）的数量
    killed_objects = gc.collect()
    print(f"GC 强制扫描完毕！成功击杀并清理的死对象容器数: {killed_objects}")

    # 恢复 GC
    gc.enable()


if __name__ == "__main__":
    trace_object_life()
