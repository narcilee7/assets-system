#!/usr/bin/env python3
"""Error budget calculator. Run: python3 budget_calculator.py"""


def error_budget(slo_pct: float, period_days: int = 30) -> dict:
    total_minutes = period_days * 24 * 60
    downtime_minutes = (100 - slo_pct) / 100 * total_minutes
    return {
        "slo": f"{slo_pct}%",
        "period_days": period_days,
        "total_minutes": total_minutes,
        "downtime_minutes": round(downtime_minutes, 2),
        "downtime_hours": round(downtime_minutes / 60, 2),
        "downtime_days": round(downtime_minutes / 60 / 24, 4),
    }


def main():
    print("=" * 60)
    print("Error Budget Calculator (30-day period)")
    print("=" * 60)
    for slo in [99.0, 99.5, 99.9, 99.95, 99.99, 99.999]:
        r = error_budget(slo)
        print(
            f"SLO {r['slo']:>7} | allow {r['downtime_minutes']:>8.2f} min = "
            f"{r['downtime_hours']:.3f} h = {r['downtime_days']:.4f} d"
        )

    # Quarterly perspective
    print("\n" + "=" * 60)
    print("Quarterly perspective (90 days)")
    print("=" * 60)
    for slo in [99.9, 99.99]:
        r = error_budget(slo, period_days=90)
        print(
            f"SLO {r['slo']:>7} | allow {r['downtime_minutes']:>10.2f} min = "
            f"{r['downtime_hours']:.2f} h"
        )


if __name__ == "__main__":
    main()
