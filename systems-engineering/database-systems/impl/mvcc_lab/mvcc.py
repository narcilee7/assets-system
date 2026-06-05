#!/usr/bin/env python3
"""
Simplified MVCC demo simulating InnoDB-style snapshot isolation.
Run: python3 mvcc.py
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class RowVersion:
    trx_id: int
    value: int
    prev: Optional["RowVersion"] = None


@dataclass
class ReadView:
    """Simplified Read View (m_ids, min_trx_id, max_trx_id, creator_trx_id)."""
    m_ids: set
    min_trx_id: int
    max_trx_id: int
    creator_trx_id: int

    def is_visible(self, trx_id: int) -> bool:
        if trx_id < self.min_trx_id:
            return True
        if trx_id >= self.max_trx_id:
            return False
        if trx_id in self.m_ids:
            return False
        return True


class MVCCStore:
    def __init__(self):
        self.rows: Dict[str, RowVersion] = {}
        self.trx_counter = 0
        self.active_trx: set = set()

    def begin_trx(self) -> int:
        self.trx_counter += 1
        tid = self.trx_counter
        self.active_trx.add(tid)
        return tid

    def commit_trx(self, tid: int):
        self.active_trx.discard(tid)

    def _make_read_view(self, tid: int) -> ReadView:
        return ReadView(
            m_ids=set(self.active_trx) - {tid},
            min_trx_id=min(self.active_trx) if self.active_trx else tid,
            max_trx_id=self.trx_counter + 1,
            creator_trx_id=tid,
        )

    def write(self, tid: int, key: str, value: int):
        old = self.rows.get(key)
        self.rows[key] = RowVersion(trx_id=tid, value=value, prev=old)

    def read_rc(self, tid: int, key: str) -> Optional[int]:
        """Read Committed: create a new Read View on every read."""
        view = self._make_read_view(tid)
        return self._read_with_view(key, view)

    def read_rr(self, tid: int, key: str, view: ReadView) -> Optional[int]:
        """Repeatable Read: reuse the same Read View."""
        return self._read_with_view(key, view)

    def _read_with_view(self, key: str, view: ReadView) -> Optional[int]:
        ver = self.rows.get(key)
        while ver:
            if view.is_visible(ver.trx_id):
                return ver.value
            ver = ver.prev
        return None


def demo_rc_vs_rr():
    store = MVCCStore()

    # Transaction A writes x=100
    ta = store.begin_trx()
    store.write(ta, "x", 100)
    store.commit_trx(ta)

    # Transaction B starts
    tb = store.begin_trx()
    view_b = store._make_read_view(tb)  # RR view

    # Read under RR
    print(f"[B RR] first read x = {store.read_rr(tb, 'x', view_b)}")

    # Transaction C writes x=200 and commits
    tc = store.begin_trx()
    store.write(tc, "x", 200)
    store.commit_trx(tc)

    # B reads again
    print(f"[B RC] second read x = {store.read_rc(tb, 'x')}")   # sees 200
    print(f"[B RR] second read x = {store.read_rr(tb, 'x', view_b)}")  # sees 100 (snapshot)

    store.commit_trx(tb)


if __name__ == "__main__":
    demo_rc_vs_rr()
