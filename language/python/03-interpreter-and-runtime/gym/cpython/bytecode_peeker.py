import dis


def optimize_target(a: int, b: int) -> int:
    return a + b


if __name__ == "__main__":
    print("=== 查看 optimize_target 函数的纯粹虚拟机字节码 ===")
    # dis.dis 会把函数的 CPython 虚拟机指令集以可读形式打印出来
    dis.dis(optimize_target)

"""
查看optimize-target
  4           RESUME                   0

  5           LOAD_FAST_LOAD_FAST      1 (a, b)
              BINARY_OP                0 (+)
              RETURN_VALUE
"""
