import sys
import ctypes

def dissect_pyobject(obj: any):
    """
    黑客手段：传入任意 Python 对象，绕过所有高级封装，
    直接去其物理内存地址上生吞活剥出 PyObject 头部。
    """
    # 1. 在 CPython 中，内建函数 id(obj) 返回的就是该对象在 C 堆区的绝对物理内存地址
    obj_address = id(obj)
    print(f"=== 正在解剖对象，物理内存首地址: {hex(obj_address)} ===")

    # 2. 根据 64 位架构定义 PyObject 的 C 语言等价映射结构体
    class PyObjectStruct(ctypes.Structure):
        _fields_ = [
            ("ob_refcnt", ctypes.c_ssize_t),  # 8 字节有符号整型
            ("ob_type", ctypes.c_void_p)      # 8 字节指针
        ]

    # 3. 强行将该物理地址处的二进制数据转换为我们的 C 结构体视图
    raw_head = PyObjectStruct.from_address(obj_address)

    # 4. 打印读取结果
    print(f"  [C层肉眼观测] ob_refcnt (引用计数): {raw_head.ob_refcnt}")
    print(f"  [C层肉眼观测] ob_type   (类型地址): {hex(raw_head.ob_type)}")
    
    # 5. 验证我们的底层解剖是否百分之百准确
    print(f"  [Python验证] 标准 sys.getrefcount 结果: {sys.getrefcount(obj)}")
    print(f"  [Python验证] 标准 type(obj) 的物理地址: {hex(id(type(obj)))}")
    
    assert raw_head.ob_type == id(type(obj)), "底层类型指针判定发生严重错位！"
    print("-> 完美吻合！成功穿透解释器沙盒。")

if __name__ == "__main__":
    # 我们故意创建一个非常独特的、没有被虚拟机提前缓存的复杂字符串
    vampire_string = "Ultimate_Deep_Dive_2026_CPython_" + str(1+1)
    dissect_pyobject(vampire_string)