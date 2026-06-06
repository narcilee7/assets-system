#!/usr/bin/env python3
"""
Capacity Calculator — Chain-1 L3 Lab

增强版容量计算器，结合排队论公式和工程经验值，
输出节点数、利用率预测、预期延迟和成本。

运行：
    python3 capacity_calculator.py --scenario web_api --target-qps 10000
    python3 capacity_calculator.py --interactive
"""

import argparse
import json
import math
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ServiceProfile:
    name: str
    cpu_ms_per_request: float      # 单请求 CPU 时间
    memory_mb_per_request: float   # 单请求内存峰值
    io_kb_per_request: float = 0   # 单请求 I/O
    network_kb_per_request: float = 0  # 单请求网络流量


# ---- Built-in profiles -----------------------------------------------------

PROFILES = {
    "simple_api": ServiceProfile("简单 API", 5, 20),
    "complex_api": ServiceProfile("复杂 API", 20, 50),
    "db_heavy": ServiceProfile("数据库密集型", 50, 100),
    "cpu_heavy": ServiceProfile("CPU 密集型", 100, 200),
    "ai_inference": ServiceProfile("AI 推理", 500, 1024, io_kb_per_request=10, network_kb_per_request=500),
}


# ---- Node specs ------------------------------------------------------------

NODE_SPECS = {
    "small": {"cpu_cores": 2, "memory_gb": 4, "cost_per_hour": 0.05},
    "medium": {"cpu_cores": 4, "memory_gb": 8, "cost_per_hour": 0.10},
    "large": {"cpu_cores": 8, "memory_gb": 16, "cost_per_hour": 0.20},
    "xl": {"cpu_cores": 16, "memory_gb": 32, "cost_per_hour": 0.40},
    "gpu": {"cpu_cores": 8, "memory_gb": 64, "cost_per_hour": 1.50, "gpu": True},
}


# ---- Core calculation ------------------------------------------------------

def calculate_capacity(
    profile: ServiceProfile,
    target_qps: float,
    peak_factor: float,
    node_type: str,
    safety_threshold: float = 0.7,
    hyperthreading: bool = True,
) -> dict:
    """
    容量计算核心逻辑。

    关键公式：
      1. CPU 承载 QPS = (cores × 1000) / cpu_ms_per_request
      2. Memory 承载 QPS = (memory_gb × 1024) / memory_mb_per_request
      3. 单节点容量 = min(CPU, Memory)
      4. 安全容量 = 单节点容量 × safety_threshold
      5. 峰值 QPS = target_qps × peak_factor
      6. 所需节点 = 峰值 QPS / 安全容量

    排队论修正：
      - 利用率 ρ = 峰值 QPS / (节点数 × 单节点 CPU 承载 QPS)
      - M/M/1 近似：平均等待时间 = service_time × ρ / (1 - ρ)
    """
    node = NODE_SPECS[node_type]
    cores = node["cpu_cores"]
    memory_gb = node["memory_gb"]

    # 超线程修正：实际有效核心 ≈ 物理核心 × 1.2（而非 × 2）
    effective_cores = cores * 1.2 if hyperthreading else cores

    cpu_limit_qps = (effective_cores * 1000) / profile.cpu_ms_per_request
    memory_limit_qps = (memory_gb * 1024) / profile.memory_mb_per_request
    node_capacity = min(cpu_limit_qps, memory_limit_qps)
    safe_capacity = node_capacity * safety_threshold

    peak_qps = target_qps * peak_factor
    nodes_needed = peak_qps / safe_capacity
    nodes_rounded = math.ceil(nodes_needed)

    # 实际利用率（使用 rounded 节点数）
    actual_rho = peak_qps / (nodes_rounded * node_capacity)
    safe_rho = peak_qps / (nodes_rounded * safe_capacity)

    # M/M/1 排队延迟估算（单请求排队等待时间）
    service_time_sec = profile.cpu_ms_per_request / 1000
    if actual_rho < 0.999:
        queue_delay_ms = service_time_sec * actual_rho / (1 - actual_rho) * 1000
    else:
        queue_delay_ms = float('inf')

    # 成本
    hourly_cost = nodes_rounded * node["cost_per_hour"]
    monthly_cost = hourly_cost * 24 * 30

    # 瓶颈识别
    bottleneck = "CPU" if cpu_limit_qps < memory_limit_qps else "Memory"

    return {
        "profile": profile.name,
        "target_qps": target_qps,
        "peak_qps": round(peak_qps, 0),
        "node_type": node_type,
        "nodes_needed": round(nodes_needed, 1),
        "nodes_rounded": nodes_rounded,
        "cpu_limit_qps_per_node": round(cpu_limit_qps, 0),
        "memory_limit_qps_per_node": round(memory_limit_qps, 0),
        "safe_qps_per_node": round(safe_capacity, 0),
        "actual_utilization": round(actual_rho, 3),
        "safe_utilization": round(safe_rho, 3),
        "estimated_queue_delay_ms": round(queue_delay_ms, 2),
        "bottleneck": bottleneck,
        "hourly_cost_usd": round(hourly_cost, 2),
        "monthly_cost_usd": round(monthly_cost, 2),
    }


def print_report(report: dict) -> None:
    print("\n" + "=" * 65)
    print(f"Capacity Report: {report['profile']}")
    print("=" * 65)
    print(f"Target QPS        : {report['target_qps']}")
    print(f"Peak QPS ({report['peak_qps']/report['target_qps']:.1f}x) : {report['peak_qps']}")
    print(f"Node Type         : {report['node_type']}")
    print(f"Nodes Needed      : {report['nodes_needed']} (rounded: {report['nodes_rounded']})")
    print("-" * 65)
    print(f"CPU Limit/Node    : {report['cpu_limit_qps_per_node']} QPS")
    print(f"Memory Limit/Node : {report['memory_limit_qps_per_node']} QPS")
    print(f"Safe Capacity/Node: {report['safe_qps_per_node']} QPS")
    print(f"Bottleneck        : {report['bottleneck']}")
    print("-" * 65)
    print(f"Actual ρ          : {report['actual_utilization']:.1%}")
    print(f"Safe ρ (headroom) : {report['safe_utilization']:.1%}")
    print(f"Est. Queue Delay  : {report['estimated_queue_delay_ms']} ms")
    if report['actual_utilization'] > 0.9:
        print("  ⚠️  WARNING: ρ > 90%, expect high latency tail and fragility.")
    elif report['actual_utilization'] > 0.8:
        print("  ⚠️  TIGHT: ρ > 80%, leave minimal headroom for bursts.")
    elif report['actual_utilization'] < 0.5:
        print("  💡 LOW: ρ < 50%, over-provisioned. Consider down-sizing.")
    print("-" * 65)
    print(f"Hourly Cost       : ${report['hourly_cost_usd']}/h")
    print(f"Monthly Cost      : ${report['monthly_cost_usd']}/mo")
    print("=" * 65)


def interactive_mode():
    print("[*] Interactive Capacity Planner")
    print("Available profiles:", ", ".join(PROFILES.keys()))
    profile_name = input("Profile [simple_api]: ").strip() or "simple_api"
    profile = PROFILES.get(profile_name)
    if not profile:
        print(f"Unknown profile: {profile_name}")
        return

    target_qps = float(input("Target QPS [1000]: ") or "1000")
    peak_factor = float(input("Peak factor [2.0]: ") or "2.0")
    print("Available node types:", ", ".join(NODE_SPECS.keys()))
    node_type = input("Node type [medium]: ").strip() or "medium"
    safety = float(input("Safety threshold [0.7]: ") or "0.7")

    report = calculate_capacity(profile, target_qps, peak_factor, node_type, safety)
    print_report(report)

    out = input("\nSave to JSON? (filename or Enter to skip): ").strip()
    if out:
        with open(out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[*] Saved to {out}")


def compare_nodes(profile_name: str, target_qps: float, peak_factor: float):
    """对比不同节点规格的成本和利用率。"""
    profile = PROFILES[profile_name]
    print(f"\n{'Node':<10} {'Nodes':>6} {'ρ':>8} {'Queue(ms)':>10} {'Monthly':>10}")
    print("-" * 50)
    for node_type in ["small", "medium", "large", "xl"]:
        r = calculate_capacity(profile, target_qps, peak_factor, node_type)
        print(f"{node_type:<10} {r['nodes_rounded']:>6} {r['actual_utilization']:>7.1%} "
              f"{r['estimated_queue_delay_ms']:>9.2f} ${r['monthly_cost_usd']:>9}")


def main():
    parser = argparse.ArgumentParser(description="Capacity Calculator")
    parser.add_argument("--scenario", choices=list(PROFILES.keys()),
                        help="Service profile")
    parser.add_argument("--target-qps", type=float, default=1000,
                        help="Target QPS")
    parser.add_argument("--peak-factor", type=float, default=2.0,
                        help="Peak traffic multiplier")
    parser.add_argument("--node-type", choices=list(NODE_SPECS.keys()), default="medium",
                        help="Node specification")
    parser.add_argument("--safety", type=float, default=0.7,
                        help="Safety threshold (0-1)")
    parser.add_argument("--compare", action="store_true",
                        help="Compare all node types")
    parser.add_argument("--interactive", action="store_true",
                        help="Interactive mode")
    parser.add_argument("--output", type=str, default="",
                        help="Save report to JSON")
    args = parser.parse_args()

    if args.interactive:
        interactive_mode()
        return

    if args.compare:
        compare_nodes(args.scenario or "simple_api", args.target_qps, args.peak_factor)
        return

    profile = PROFILES.get(args.scenario, PROFILES["simple_api"])
    report = calculate_capacity(profile, args.target_qps, args.peak_factor,
                                args.node_type, args.safety)
    print_report(report)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[*] Report saved to {args.output}")


if __name__ == "__main__":
    main()
