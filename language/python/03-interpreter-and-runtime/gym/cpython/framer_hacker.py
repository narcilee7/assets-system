import sys


def inner_vampire_function() -> None:
    caller_frame = sys._getframe().f_back

    if caller_frame is None:
        return

    print("--- [Inner] 成功捕获上层执行上下文 ---")
    print(f"父函数名称: {caller_frame.f_code.co_name}")
    print(f"父函数当前的局部变量表(Fast Locals 映射): {caller_frame.f_locals}")

    caller_frame.f_locals["target_variables"] = "Manipulated by Vampire!"

    import ctypes

    ctypes.pythonapi.PyFrame_LocalsToFast(
        ctypes.py_object(caller_frame),
        ctypes.c_int(1),  # 1 代表强行写入覆盖
    )
    print("[Inner] 父函数局部变量篡改完毕。")


def caller_endpoint() -> str:
    """调用端：内部声明一个安全的局部变量"""
    target_variable = "Pure and Innocent Gold"

    # 执行破坏
    inner_vampire_function()

    # 再次返回，观察自己的局部变量是否被“隔空取物”
    return target_variable


if __name__ == "__main__":
    final_state = caller_endpoint()
    print(f"\n=== [Main] 最终父函数返回的值: {final_state} ===")
