#!/usr/bin/env python3
"""
Capacity Simulator — Chain-1 L3 Lab

基于排队论的容量模拟器。通过离散事件模拟（DES）验证：
  - Little's Law: L = λ × W
  - M/M/1 队列的利用率-延迟关系
  - 为什么 80% 利用率是安全阈值

运行：
    python3 capacity_simulator.py --lambda 1000 --mu 500 --servers 4 --time 60
    python3 capacity_simulator.py --sweep --max-rho 0.99
"""

import argparse
import heapq
import math
import random
import statistics
from dataclasses import dataclass, field
from typing import List


@dataclass
class Event:
    time: float
    type: str  # 'arrival', 'departure'
    job_id: int

    def __lt__(self, other):
        return self.time < other.time


@dataclass
class Job:
    id: int
    arrival_time: float
    start_time: float = 0.0
    departure_time: float = 0.0


@dataclass
class SimulationResult:
    lambda_rate: float
    mu_rate: float
    servers: int
    duration: float
    rho: float
    jobs_completed: int
    jobs_dropped: int
    avg_queue_length: float
    avg_system_time: float
    avg_wait_time: float
    avg_service_time: float
    p99_wait_time: float
    p99_system_time: float
    server_utilization: float


def run_mm1_simulation(lambda_rate: float, mu_rate: float, servers: int,
                       duration: float, seed: int = 42,
                       max_queue_size: int = 0) -> SimulationResult:
    """
    M/M/c 队列离散事件模拟。

    参数：
        lambda_rate: 到达率（请求/秒）
        mu_rate: 单服务器服务率（请求/秒/核）
        servers: 服务器/核心数
        duration: 模拟时长（秒）
        max_queue_size: 最大队列长度（0=无限）

    返回：
        SimulationResult
    """
    random.seed(seed)

    # 事件队列（最小堆）
    events: List[Event] = []
    current_time = 0.0

    # 生成第一个到达事件（泊松过程，间隔服从指数分布）
    next_arrival = random.expovariate(lambda_rate)
    heapq.heappush(events, Event(next_arrival, "arrival", 0))

    # 系统状态
    queue: List[Job] = []
    busy_servers = 0
    jobs = {}
    next_job_id = 0
    completed_jobs = []
    dropped_jobs = 0

    # 用于计算时间平均队列长度
    last_event_time = 0.0
    area_queue = 0.0  # 队列长度对时间的积分
    area_system = 0.0  # 系统中作业数对时间的积分

    while events and current_time < duration:
        event = heapq.heappop(events)
        prev_time = current_time
        current_time = event.time

        # 更新面积（用于时间平均）
        dt = current_time - prev_time
        area_queue += len(queue) * dt
        area_system += (len(queue) + busy_servers) * dt

        if event.type == "arrival":
            next_job_id += 1
            job = Job(id=next_job_id, arrival_time=current_time)
            jobs[next_job_id] = job

            if busy_servers < servers:
                # 立即服务
                busy_servers += 1
                job.start_time = current_time
                service_time = random.expovariate(mu_rate)
                job.departure_time = current_time + service_time
                heapq.heappush(events, Event(job.departure_time, "departure", job.id))
            elif max_queue_size == 0 or len(queue) < max_queue_size:
                # 进入队列等待
                queue.append(job)
            else:
                # 队列满，丢弃
                dropped_jobs += 1

            # 生成下一个到达事件
            next_arrival = current_time + random.expovariate(lambda_rate)
            if next_arrival < duration:
                heapq.heappush(events, Event(next_arrival, "arrival", next_job_id))

        elif event.type == "departure":
            job = jobs.get(event.job_id)
            if job:
                job.departure_time = current_time
                completed_jobs.append(job)
                del jobs[event.job_id]

            if queue:
                # 队列中有等待的作业，立即开始服务
                next_job = queue.pop(0)
                next_job.start_time = current_time
                service_time = random.expovariate(mu_rate)
                next_job.departure_time = current_time + service_time
                heapq.heappush(events, Event(next_job.departure_time, "departure", next_job.id))
            else:
                busy_servers -= 1

    # 计算统计指标
    if not completed_jobs:
        return SimulationResult(
            lambda_rate=lambda_rate, mu_rate=mu_rate, servers=servers,
            duration=duration, rho=0.0, jobs_completed=0, jobs_dropped=dropped_jobs,
            avg_queue_length=0.0, avg_system_time=0.0, avg_wait_time=0.0,
            avg_service_time=0.0, p99_wait_time=0.0, p99_system_time=0.0,
            server_utilization=0.0,
        )

    wait_times = [(j.start_time - j.arrival_time) for j in completed_jobs]
    system_times = [(j.departure_time - j.arrival_time) for j in completed_jobs]
    service_times = [(j.departure_time - j.start_time) for j in completed_jobs]

    rho = lambda_rate / (servers * mu_rate)
    total_busy_time = sum(service_times)
    utilization = total_busy_time / (duration * servers)

    return SimulationResult(
        lambda_rate=lambda_rate,
        mu_rate=mu_rate,
        servers=servers,
        duration=duration,
        rho=rho,
        jobs_completed=len(completed_jobs),
        jobs_dropped=dropped_jobs,
        avg_queue_length=area_queue / duration,
        avg_system_time=statistics.mean(system_times) * 1000,  # ms
        avg_wait_time=statistics.mean(wait_times) * 1000,      # ms
        avg_service_time=statistics.mean(service_times) * 1000, # ms
        p99_wait_time=sorted(wait_times)[int(len(wait_times) * 0.99)] * 1000,
        p99_system_time=sorted(system_times)[int(len(system_times) * 0.99)] * 1000,
        server_utilization=utilization,
    )


def theoretical_mm1(lambda_rate: float, mu_rate: float, servers: int) -> dict:
    """M/M/c 队列的理论公式。"""
    rho = lambda_rate / (servers * mu_rate)
    if rho >= 1.0:
        return {"rho": rho, "valid": False, "reason": "ρ >= 1, system unstable"}

    # M/M/1 简化公式（单服务器）
    if servers == 1:
        Lq = rho ** 2 / (1 - rho)          # 平均队列长度
        Wq = Lq / lambda_rate               # 平均等待时间（秒）
        W = Wq + 1 / mu_rate                # 平均系统时间（秒）
        L = lambda_rate * W                 # 平均系统中作业数
        return {
            "rho": rho,
            "valid": True,
            "avg_queue_length": Lq,
            "avg_wait_time_ms": Wq * 1000,
            "avg_system_time_ms": W * 1000,
            "avg_jobs_in_system": L,
        }

    # M/M/c 近似（Erlang C 公式较复杂，这里用简化近似）
    # 当 c 较大时，可近似为 M/M/1 但服务率变为 c*μ
    Lq_approx = (rho ** 2) / (1 - rho) if rho < 0.9 else float('inf')
    Wq_approx = Lq_approx / lambda_rate
    W_approx = Wq_approx + 1 / mu_rate
    return {
        "rho": rho,
        "valid": True,
        "avg_queue_length_approx": Lq_approx,
        "avg_wait_time_ms_approx": Wq_approx * 1000,
        "avg_system_time_ms_approx": W_approx * 1000,
    }


def print_result(result: SimulationResult) -> None:
    print("\n" + "=" * 65)
    print("M/M/c Queue Simulation Result")
    print("=" * 65)
    print(f"Parameters: λ={result.lambda_rate}/s, μ={result.mu_rate}/s, servers={result.servers}")
    print(f"Duration:   {result.duration}s")
    print(f"Theoretical ρ: {result.rho:.3f}")
    print(f"Actual utilization: {result.server_utilization:.3f}")
    print("-" * 65)
    print(f"Jobs completed: {result.jobs_completed}")
    print(f"Jobs dropped:   {result.jobs_dropped}")
    print("-" * 65)
    print("Time Averages:")
    print(f"  Avg queue length:     {result.avg_queue_length:.3f}")
    print(f"  Avg wait time:        {result.avg_wait_time:.3f} ms")
    print(f"  P99 wait time:        {result.p99_wait_time:.3f} ms")
    print(f"  Avg service time:     {result.avg_service_time:.3f} ms")
    print(f"  Avg system time:      {result.avg_system_time:.3f} ms")
    print(f"  P99 system time:      {result.p99_system_time:.3f} ms")
    print("=" * 65)

    # Little's Law 验证
    L_from_sim = result.avg_queue_length + result.server_utilization * result.servers
    L_from_law = result.lambda_rate * (result.avg_system_time / 1000)
    print("\n📐 Little's Law Verification")
    print(f"  L (from simulation) = {L_from_sim:.3f}")
    print(f"  L (from λ × W)      = {L_from_law:.3f}")
    diff_pct = abs(L_from_sim - L_from_law) / L_from_law * 100 if L_from_law > 0 else 0
    print(f"  Difference: {diff_pct:.2f}%")
    if diff_pct < 5:
        print("  ✅ Little's Law holds")
    else:
        print("  ⚠️  Transient effects or simulation too short")


def run_sweep(max_rho: float = 0.99) -> None:
    """扫描利用率从 10% 到 max_rho，绘制利用率-延迟曲线。"""
    mu = 100  # 固定服务率
    servers = 4
    duration = 30

    print(f"\n{'ρ':>6} {'λ':>8} {'Util%':>8} {'AvgWait':>10} {'P99Wait':>10} {'AvgSys':>10} {'P99Sys':>10}")
    print("-" * 70)

    for rho in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99]:
        if rho > max_rho:
            break
        lam = rho * servers * mu
        result = run_mm1_simulation(lam, mu, servers, duration, seed=42)
        print(f"{rho:>6.2f} {lam:>8.1f} {result.server_utilization*100:>7.1f}% "
              f"{result.avg_wait_time:>9.2f} {result.p99_wait_time:>9.2f} "
              f"{result.avg_system_time:>9.2f} {result.p99_system_time:>9.2f}")

    print("\n💡 Insight:")
    print("   ρ < 0.5: 延迟稳定，队列几乎为空")
    print("   ρ = 0.7: 开始出现可感知排队")
    print("   ρ = 0.8: 平均等待时间 ≈ 服务时间（经典安全阈值）")
    print("   ρ > 0.9: P99 延迟指数级上升，系统脆弱")


def main():
    parser = argparse.ArgumentParser(description="M/M/c Capacity Simulator")
    parser.add_argument("--lambda", dest="lambda_rate", type=float, default=100,
                        help="Arrival rate (requests/sec)")
    parser.add_argument("--mu", type=float, default=50,
                        help="Service rate per server (requests/sec)")
    parser.add_argument("--servers", type=int, default=4,
                        help="Number of servers/cores")
    parser.add_argument("--time", type=float, default=60,
                        help="Simulation duration (seconds)")
    parser.add_argument("--sweep", action="store_true",
                        help="Run utilization sweep instead of single simulation")
    parser.add_argument("--max-rho", type=float, default=0.99,
                        help="Max utilization for sweep")
    args = parser.parse_args()

    if args.sweep:
        run_sweep(args.max_rho)
    else:
        result = run_mm1_simulation(
            args.lambda_rate, args.mu, args.servers, args.time, seed=42
        )
        print_result(result)

        # 理论对比
        theory = theoretical_mm1(args.lambda_rate, args.mu, args.servers)
        if theory["valid"]:
            print("\n📊 Theoretical (M/M/c approximation):")
            for k, v in theory.items():
                if k not in ("valid", "reason"):
                    if isinstance(v, float):
                        print(f"  {k}: {v:.3f}")
                    else:
                        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
