#!/usr/bin/env python3
"""
Latency Budget Calculator — Chain-1 L3 Lab

可运行的延迟预算计算器。输入请求链路上各组件的延迟，
自动计算总延迟、识别瓶颈、给出优化建议。

运行：
    python3 budget_calculator.py --scenario web_api
    python3 budget_calculator.py --json scenario.json
    python3 budget_calculator.py --interactive

示例 scenario.json：
{
  "name": "Order API",
  "sla_p99_ms": 200,
  "components": [
    {"name": "DNS",           "p50_ms": 5,   "p99_ms": 20,  "parallel": false},
    {"name": "TCP+TLS",       "p50_ms": 10,  "p99_ms": 30,  "parallel": false},
    {"name": "LB",            "p50_ms": 1,   "p99_ms": 3,   "parallel": false},
    {"name": "Nginx",         "p50_ms": 2,   "p99_ms": 5,   "parallel": false},
    {"name": "App Logic",     "p50_ms": 20,  "p99_ms": 50,  "parallel": false},
    {"name": "Redis (cache)", "p50_ms": 2,   "p99_ms": 5,   "parallel": false},
    {"name": "MySQL (query)", "p50_ms": 5,   "p99_ms": 30,  "parallel": false}
  ]
}
"""

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Component:
    name: str
    p50_ms: float
    p99_ms: float
    parallel: bool = False  # 如果为 True，则该组件与上一个组件并行执行
    notes: str = ""


@dataclass
class Scenario:
    name: str
    sla_p99_ms: float
    components: List[Component]
    description: str = ""


# ---- Built-in scenarios ----------------------------------------------------

BUILTIN_SCENARIOS = {
    "web_api": Scenario(
        name="典型 Web API 请求",
        sla_p99_ms=200,
        description="客户端 -> CDN -> LB -> Nginx -> App -> Redis -> MySQL",
        components=[
            Component("DNS",           5,   20),
            Component("TCP+TLS",       10,  30),
            Component("CDN",           5,   15),
            Component("LB",            1,   3),
            Component("Nginx",         2,   5),
            Component("App Logic",     20,  50),
            Component("Redis",         2,   5),
            Component("MySQL",         5,   30),
        ],
    ),
    "microservice": Scenario(
        name="微服务链式调用",
        sla_p99_ms=500,
        description="Gateway -> Auth -> User -> Order -> Payment",
        components=[
            Component("Gateway",       2,   5),
            Component("Auth",          10,  30),
            Component("User",          15,  40),
            Component("Order",         20,  60),
            Component("Payment",       50,  150),
        ],
    ),
    "ai_inference": Scenario(
        name="AI 推理服务",
        sla_p99_ms=2000,
        description="Client -> API Gateway -> Queue -> GPU Worker -> Post-process",
        components=[
            Component("DNS+TLS",       10,  30),
            Component("API Gateway",   5,   15),
            Component("Queue Wait",    50,  200),
            Component("GPU Inference", 300, 800),
            Component("Post-process",  20,  50),
        ],
    ),
}


# ---- Calculation logic -----------------------------------------------------

def calculate_budget(scenario: Scenario) -> dict:
    """
    延迟预算计算。

    关键假设：
      - P50 总延迟 = 串行组件 P50 之和（并行组件取最大值）
      - P99 总延迟 = 串行组件 P99 之和（并行组件取最大值）
      - 该假设是保守估计，实际 P99 叠加有随机性，但工程上常用
    """
    total_p50 = 0.0
    total_p99 = 0.0
    component_results = []

    # 处理串行和并行组件
    i = 0
    while i < len(scenario.components):
        comp = scenario.components[i]
        if comp.parallel and i > 0:
            # 并行：与上一个组件取 max，不额外累加
            prev = component_results[-1]
            added_p50 = max(0, comp.p50_ms - prev["p50_ms"])
            added_p99 = max(0, comp.p99_ms - prev["p99_ms"])
            total_p50 += added_p50
            total_p99 += added_p99
            component_results.append({
                "name": comp.name,
                "p50_ms": comp.p50_ms,
                "p99_ms": comp.p99_ms,
                "added_p50_ms": added_p50,
                "added_p99_ms": added_p99,
                "p99_pct": 0.0,  # 稍后计算
                "parallel": True,
            })
        else:
            total_p50 += comp.p50_ms
            total_p99 += comp.p99_ms
            component_results.append({
                "name": comp.name,
                "p50_ms": comp.p50_ms,
                "p99_ms": comp.p99_ms,
                "added_p50_ms": comp.p50_ms,
                "added_p99_ms": comp.p99_ms,
                "p99_pct": 0.0,
                "parallel": False,
            })
        i += 1

    # 计算每个组件对 P99 的贡献占比
    for r in component_results:
        r["p99_pct"] = round(r["added_p99_ms"] / total_p99 * 100, 1) if total_p99 > 0 else 0.0

    # 瓶颈识别：贡献占比 > 20% 的组件
    bottlenecks = [r for r in component_results if r["p99_pct"] > 20.0]

    # 与 SLA 对比
    sla_headroom_ms = scenario.sla_p99_ms - total_p99
    sla_headroom_pct = round(sla_headroom_ms / scenario.sla_p99_ms * 100, 1)

    # Sensitivity analysis：每个组件优化 50% 后的总 P99
    sensitivities = []
    for r in component_results:
        new_total = total_p99 - r["added_p99_ms"] * 0.5
        improvement = round((total_p99 - new_total) / total_p99 * 100, 1)
        sensitivities.append({
            "component": r["name"],
            "current_p99_ms": r["p99_ms"],
            "improved_total_p99_ms": round(new_total, 1),
            "improvement_pct": improvement,
        })
    sensitivities.sort(key=lambda x: x["improvement_pct"], reverse=True)

    return {
        "scenario": scenario.name,
        "sla_p99_ms": scenario.sla_p99_ms,
        "total_p50_ms": round(total_p50, 1),
        "total_p99_ms": round(total_p99, 1),
        "sla_headroom_ms": round(sla_headroom_ms, 1),
        "sla_headroom_pct": sla_headroom_pct,
        "components": component_results,
        "bottlenecks": bottlenecks,
        "sensitivities": sensitivities[:3],  # Top 3 高价值优化
    }


# ---- Output ----------------------------------------------------------------

def print_report(report: dict) -> None:
    print("\n" + "=" * 70)
    print(f"Latency Budget Report: {report['scenario']}")
    print("=" * 70)
    print(f"SLA P99 Target    : {report['sla_p99_ms']} ms")
    print(f"Estimated Total   : P50 = {report['total_p50_ms']} ms, P99 = {report['total_p99_ms']} ms")
    print(f"SLA Headroom      : {report['sla_headroom_ms']} ms ({report['sla_headroom_pct']}%)")
    if report["sla_headroom_ms"] < 0:
        print("  ⚠️  WARNING: Budget exceeds SLA! Need optimization or SLA relaxation.")
    elif report["sla_headroom_ms"] < report["sla_p99_ms"] * 0.1:
        print("  ⚠️  TIGHT: Headroom < 10%, consider adding buffer.")
    print("-" * 70)
    print(f"{'Component':<20} {'P50(ms)':<10} {'P99(ms)':<10} {'Added P99':<12} {'Contrib%':<10} {'Type'}")
    print("-" * 70)
    for c in report["components"]:
        ptype = "parallel" if c.get("parallel") else "serial"
        print(f"{c['name']:<20} {c['p50_ms']:<10.1f} {c['p99_ms']:<10.1f} "
              f"{c['added_p99_ms']:<12.1f} {c['p99_pct']:<10.1f} {ptype}")
    print("-" * 70)

    if report["bottlenecks"]:
        print("🔴 Bottlenecks (P99 contribution > 20%):")
        for b in report["bottlenecks"]:
            print(f"   - {b['name']}: {b['p99_ms']} ms ({b['p99_pct']}%)")
    else:
        print("✅ No single bottleneck > 20%. Budget is well-balanced.")

    print("-" * 70)
    print("📈 Top 3 Sensitivity (optimize this component by 50%):")
    for s in report["sensitivities"]:
        print(f"   - {s['component']}: total P99 -> {s['improved_total_p99_ms']} ms "
              f"(improvement {s['improvement_pct']}%)")
    print("=" * 70)


def interactive_mode() -> None:
    print("[*] Interactive Latency Budget Builder")
    name = input("Scenario name: ").strip() or "Custom"
    sla = float(input("SLA P99 (ms) [200]: ") or "200")
    n = int(input("Number of components [5]: ") or "5")
    components = []
    for i in range(n):
        print(f"\n--- Component {i+1} ---")
        cname = input("Name: ").strip()
        if not cname:
            break
        p50 = float(input("P50 (ms): "))
        p99 = float(input("P99 (ms): "))
        parallel = input("Parallel with previous? (y/N): ").lower().startswith("y")
        components.append(Component(cname, p50, p99, parallel))

    scenario = Scenario(name=name, sla_p99_ms=sla, components=components)
    report = calculate_budget(scenario)
    print_report(report)

    out = input("\nSave to JSON? (filename or Enter to skip): ").strip()
    if out:
        with open(out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[*] Saved to {out}")


# ---- Main ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Latency Budget Calculator")
    parser.add_argument("--scenario", choices=list(BUILTIN_SCENARIOS.keys()),
                        help="Use built-in scenario")
    parser.add_argument("--json", type=str, default="",
                        help="Load scenario from JSON file")
    parser.add_argument("--interactive", action="store_true",
                        help="Interactive mode")
    parser.add_argument("--output", type=str, default="",
                        help="Save report to JSON file")
    args = parser.parse_args()

    if args.interactive:
        interactive_mode()
        return

    if args.json:
        with open(args.json) as f:
            data = json.load(f)
        scenario = Scenario(
            name=data["name"],
            sla_p99_ms=data["sla_p99_ms"],
            components=[Component(**c) for c in data["components"]],
            description=data.get("description", ""),
        )
    elif args.scenario:
        scenario = BUILTIN_SCENARIOS[args.scenario]
    else:
        # 默认使用 web_api
        scenario = BUILTIN_SCENARIOS["web_api"]

    report = calculate_budget(scenario)
    print_report(report)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[*] Report saved to {args.output}")


if __name__ == "__main__":
    main()
