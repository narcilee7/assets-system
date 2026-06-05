#!/usr/bin/env python3
"""
Generate 4 categories of slow queries against MySQL.
Requires: pip install mysql-connector-python
"""

import mysql.connector
import time
import threading

CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "rootpass",
    "database": "testdb",
}


def get_conn():
    return mysql.connector.connect(**CONFIG)


def scenario_no_index():
    """Full table scan because of missing index on secondary column."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders WHERE status = 'pending'")
    cur.fetchall()
    conn.close()


def scenario_deep_pagination():
    """Deep OFFSET causes massive rows scanning."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 100000")
    cur.fetchall()
    conn.close()


def scenario_lock_contention():
    """Hold lock in one thread, query in another."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("BEGIN")
    cur.execute("SELECT * FROM orders WHERE id = 1 FOR UPDATE")
    time.sleep(3)
    cur.execute("ROLLBACK")
    conn.close()


def scenario_big_join():
    """Cartesian-like join without proper indexes."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT o.*, u.name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.amount > 100
        ORDER BY o.created_at
    """)
    cur.fetchall()
    conn.close()


def run_all():
    print("Generating slow queries...")
    # 1. no index
    for _ in range(5):
        scenario_no_index()
    print("[done] no-index scans")

    # 2. deep pagination
    for _ in range(3):
        scenario_deep_pagination()
    print("[done] deep pagination")

    # 3. lock contention (run blocker in background)
    t = threading.Thread(target=scenario_lock_contention)
    t.start()
    time.sleep(0.5)
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM orders WHERE id = 1 FOR UPDATE")
    except Exception as e:
        print(f"[done] lock contention (expected timeout or wait): {e}")
    conn.close()
    t.join()

    # 4. big join
    for _ in range(3):
        scenario_big_join()
    print("[done] big joins")

    print("Load generation complete.")


if __name__ == "__main__":
    run_all()
