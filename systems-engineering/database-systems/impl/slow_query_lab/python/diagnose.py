#!/usr/bin/env python3
"""
Auto-diagnose slow queries using MySQL sys schema and EXPLAIN.
Requires: pip install mysql-connector-python
"""

import mysql.connector
import json

CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "rootpass",
    "database": "testdb",
}


def get_conn():
    return mysql.connector.connect(**CONFIG)


def diagnose():
    conn = get_conn()
    cur = conn.cursor(dictionary=True)

    print("=== Slow Query Diagnosis ===\n")

    # 1. Current processlist
    print("--- 1. Running Queries ---")
    cur.execute("""
        SELECT id, user, host, db, command, time, state, left(info, 100) as query
        FROM information_schema.processlist
        WHERE command != 'Sleep' AND info IS NOT NULL
        ORDER BY time DESC
    """)
    for row in cur.fetchall()[:5]:
        print(f"  [{row['time']}s] {row['query']}")

    # 2. sys.statements_with_full_table_scans
    print("\n--- 2. Top Full Table Scans ---")
    try:
        cur.execute("""
            SELECT query, db, exec_count, total_latency, rows_sent_avg
            FROM sys.statements_with_full_table_scans
            ORDER BY total_latency DESC LIMIT 5
        """)
        for row in cur.fetchall():
            print(f"  {row['query'][:80]}... | exec={row['exec_count']} latency={row['total_latency']}")
    except Exception as e:
        print(f"  sys schema not available or error: {e}")

    # 3. Lock waits
    print("\n--- 3. Lock Waits ---")
    try:
        cur.execute("""
            SELECT r.object_schema, r.object_name, r.thread_id AS waiting_thread,
                   b.thread_id AS blocking_thread, r.lock_type AS waiting_lock,
                   b.lock_type AS blocking_lock
            FROM performance_schema.data_lock_waits w
            JOIN performance_schema.data_locks r ON r.engine_lock_id = w.requesting_engine_lock_id
            JOIN performance_schema.data_locks b ON b.engine_lock_id = w.blocking_engine_lock_id
            LIMIT 5
        """)
        rows = cur.fetchall()
        if rows:
            for row in rows:
                print(f"  waiting={row['waiting_thread']} blocking={row['blocking_thread']} table={row['object_name']}")
        else:
            print("  No current lock waits")
    except Exception as e:
        print(f"  performance_schema.data_lock_waits not available: {e}")

    # 4. EXPLAIN example
    print("\n--- 4. EXPLAIN: no-index query ---")
    cur.execute("EXPLAIN FORMAT=JSON SELECT * FROM orders WHERE status = 'pending'")
    explain = cur.fetchone()
    if explain:
        # mysql-connector returns a dict with one key
        key = list(explain.keys())[0]
        try:
            parsed = json.loads(explain[key])
            print(json.dumps(parsed, indent=2)[:800])
        except Exception:
            print(explain[key][:500])

    conn.close()
    print("\nDiagnosis complete.")


if __name__ == "__main__":
    diagnose()
