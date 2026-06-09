# 并发模型：threading + queue
import threading
import queue

def generate(n, out_q):
    for i in range(1, n + 1):
        out_q.put(i)
    out_q.put(None)

def square_worker(in_q, out_q):
    # TODO: 从 in_q 读取；如果为 None 则放入 out_q 并退出；否则计算平方后放入 out_q
    pass

def fan_out(in_q, num_workers, out_q):
    # TODO: 启动 num_workers 个线程执行 square_worker
    # TODO: 等待所有 worker 结束后，向 out_q 发送结束标记
    pass

def sum_stage(in_q, result):
    s = 0
    while True:
        v = in_q.get()
        if v is None:
            break
        s += v
    result[0] = s

def main():
    n = 100
    workers = 4
    expected = n * (n + 1) * (2 * n + 1) // 6

    q1 = queue.Queue()
    q2 = queue.Queue()
    result = [0]

    t1 = threading.Thread(target=generate, args=(n, q1))
    t2 = threading.Thread(target=fan_out, args=(q1, workers, q2))
    t3 = threading.Thread(target=sum_stage, args=(q2, result))

    t1.start()
    t2.start()
    t3.start()

    t1.join()
    t2.join()
    t3.join()

    if result[0] == expected:
        print(f"PASS: sum = {result[0]} (expected {expected}) with {workers} workers")
    else:
        print(f"FAIL: sum = {result[0]} (expected {expected})")

if __name__ == "__main__":
    main()
