import dis
import types


def compute_power(x):
    return x.value + 1


if __name__ == "__main__":
    print("=== 1. 提取静态 CodeObject 内部的元数据 ===")
    code_obj: types.CodeType = compute_power.__code__
    print(f"常量表 (co_consts): {code_obj.co_consts}")
    print(f"全局/属性名表 (co_names): {code_obj.co_names}")
    print(f"局部变量表 (co_varnames): {code_obj.co_varnames}")

    print("\n=== 2. 查看带有内联缓存槽的现代虚拟机指令集 ===")
    # show_caches=True 可以强行让我们看到隐藏在字节码中间的 CACHE 槽
    dis.dis(compute_power, show_caches=True)
