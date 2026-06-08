# 并发模型：threading + queue
import threading
import queue

def generate(n, out_q):
    # TODO: 生成 1..n，放入 out_q，最后放入 None 作为结束标记
    pass

def square(in_q, out_q):
    # TODO: 从 in_q 读取；如果为 None 则转发到 out_q 并退出；否则计算平方后放入 out_q
    pass

def sum_stage(in_q, result):
    # TODO: 从 in_q 读取，累加，遇到 None 时停止，将结果写入 result[0]
    pass

def main():
    n = 100
    expected = n * (n + 1) * (2 * n + 1) // 6

    q1 = queue.Queue()
    q2 = queue.Queue()
    result = [0]

    t1 = threading.Thread(target=generate, args=(n, q1))
    t2 = threading.Thread(target=square, args=(q1, q2))
    t3 = threading.Thread(target=sum_stage, args=(q2, result))

    t1.start()
    t2.start()
    t3.start()

    t1.join()
    t2.join()
    t3.join()

    if result[0] == expected:
        print(f"PASS: sum = {result[0]} (expected {expected})")
    else:
        print(f"FAIL: sum = {result[0]} (expected {expected})")

if __name__ == "__main__":
    main()
