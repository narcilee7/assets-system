import threading
import time


class NaiveBank:
    def __init__(self) -> None:
        self.balance: int = 0

    def unsafe_deposit(self) -> None:
        """
        看似人畜无害的自增。
        由于一条 self.balance += 1 在底层是多步字节码，
        多线程交织时必定发生‘更新丢失’。
        """
        for _ in range(100_000):
            self.balance += 1


if __name__ == "__main__":
    print("=== [GIL 原子性幻觉测试开始] ===")
    bank = NaiveBank()

    # 启动两个线程，每个线程尝试将余额自增 100,000 次
    t1 = threading.Thread(target=bank.unsafe_deposit)
    t2 = threading.Thread(target=bank.unsafe_deposit)

    start_time = time.perf_counter()
    t1.start()
    t2.start()

    t1.join()
    t2.join()
    end_time = time.perf_counter()

    expected = 200_000
    actual = bank.balance
    loss = expected - actual

    print(f"理论应得余额: {expected}")
    print(f"最终实际余额: {actual}")
    print(f"因为没有加锁，在 GIL 眼皮底下平白消失的钱: {loss} 元！")
    print(f"耗时: {(end_time - start_time) * 1000:.2f} ms")
