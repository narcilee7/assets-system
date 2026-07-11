# language/python/concurrency/custom_thread_pool.py
import threading
import queue
import time
from typing import Callable, Any

class DynamicThreadPool:
    def __init__(self, min_workers: int, max_workers: int) -> None:
        """
        高并发自适应动态线程池
        :param min_workers: 核心常驻线程数
        :param max_workers: 物理线程上限
        """
        self.min_workers = min_workers
        self.max_workers = max_workers
        
        # 核心任务队列
        self.task_queue: queue.Queue = queue.Queue()
        
        # 保护线程计数的物理独占锁
        self.lock = threading.Lock()
        
        # 存活的工作线程总数（核心 + 额外）
        self.current_workers = 0

        # 预先孵化核心线程常驻阵地
        with self.lock:
            for _ in range(self.min_workers):
                self._spawn_worker(is_core=True)

    def _spawn_worker(self, is_core: bool) -> None:
        """物理孵化一个内核级线程"""
        # 💡 核心考点：必须设置为 Daemon 线程！
        # 架构原理：Daemon=True 意味着将该线程标记为“后台守护进程”。当 Python 主线程执行完毕退出时，
        # 虚拟机不需要等待这些工作线程结束，会直接物理强制强制销毁它们，防止程序在线上死锁挂起。
        t = threading.Thread(target=self._worker_lifecycle, args=(is_core,), daemon=True)
        self.current_workers += 1
        t.start()

    def submit(self, task: Callable[..., Any], *args: Any) -> None:
        """向线程池派发任务的核心网关"""
        with self.lock:
            # 1. 如果当前总线程数还没有达到物理上限，且队列已经有积压倾向
            # 我们采取激进的扩展策略：立即动态增殖额外线程以应对洪峰
            if self.current_workers < self.max_workers and self.task_queue.qsize() >= 0:
                # 只有当现有线程不够用（当前存活线程小于最大限制）时才孵化非核心线程
                if self.current_workers < self.max_workers:
                    self._spawn_worker(is_core=False)
                    
        # 2. 任务无阻碍压入标准队列，解除底层锁的争抢
        self.task_queue.put((task, args))

    def _worker_lifecycle(self, is_core: bool) -> None:
        """工作线程的完整生命周期状态机"""
        while True:
            try:
                if is_core:
                    # 核心线程：永不超时，死等任务（利用标准队列底层的 Condition 阻塞，不耗 CPU）
                    task, args = self.task_queue.get(block=True)
                else:
                    # 额外非核心线程：只等待 2 秒（超时收缩阈值）
                    # 💡 核心考点：通过 queue.Queue(timeout=2) 原生机制替代显式的 threading.Event，性能翻倍！
                    task, args = self.task_queue.get(block=True, timeout=2.0)
                
                # 执行真实业务计算
                try:
                    task(*args)
                except Exception as e:
                    print(f"❌ [Worker Error] 业务代码执行崩溃: {e}")
                finally:
                    # 宣告该任务处理完毕
                    self.task_queue.task_done()
                    
            except queue.Empty:
                # 💡 核心考点：超时收缩逻辑触发！
                # 当额外线程等待 2 秒仍没有任务进来，说明洪峰已过，开始体面自杀
                with self.lock:
                    # 再次双重检查，确保不会误杀低于最小核心线以下的常驻线程
                    if self.current_workers > self.min_workers and not is_core:
                        self.current_workers -= 1
                        print(f"📉 [Shrink] 洪峰消退，额外线程 {threading.current_thread().name} 优雅销毁。当前存活线程: {self.current_workers}")
                        return # 结束函数运行，线程物理消亡
                    else:
                        # 如果在临界点突然变成了核心线程状态，则继续苟活
                        continue

# ================= 🚀 生产环境级仿真压测 =================

def heavy_ai_task(task_id: int):
    """模拟 Agent 复杂的 Token 计算或网络 I/O"""
    time.sleep(0.5)
    print(f"⚙️ [Execute] 任务-{task_id} 处理完毕 (驱动线程: {threading.current_thread().name})")

if __name__ == "__main__":
    print("=== [手写动态自适应线程池特训启动] ===")
    # 核心常驻 2 个线程，最高突发允许扩展到 5 个线程
    pool = DynamicThreadPool(min_workers=2, max_workers=5)
    print(f"🚀 初始化核心常驻阵地完毕。初始存活线程数: {pool.current_workers}\n")

    # 1. 瞬间洪峰：倾泻 10 个重度计算任务
    print("💥 倾泻第一波高并发洪峰 (10个任务)...")
    for i in range(10):
        pool.submit(heavy_ai_task, i)
    
    print(f"📊 [Monitor] 洪峰时实时存活线程数 (应触及上限 5): {pool.current_workers}\n")
    
    # 等待第一波任务全部处理完毕
    time.sleep(1.5)
    print(f"\n☕ 任务结束，系统进入空闲期。当前存活线程数: {pool.current_workers} (等待 2 秒空闲超时)...")
    
    # 2. 静静等待 2.5 秒，观察非核心线程是否自动被操作系统挥刀自戮
    time.sleep(2.5)
    print(f"\n📊 [Monitor] 最终收缩后的存活线程数 (应回归核心线 2): {pool.current_workers}")
    print("=== [特训演练大获全胜] ===")