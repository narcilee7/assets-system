from copy import copy
from dataclasses import dataclass
from logging import Logger
from tkinter.constants import N
from typing import List
from xxlimited import new

from typing_extensions import Any


@dataclass
class WalLogRecord:
    lsn: int
    page_id: int
    old_val: int
    new_val: int
    committed: bool = False


log = Logger(__name__)


class WAL:
    def __init__(self) -> None:
        self.logger_buffer: List[WalLogRecord] = []
        self.log_files: List[WalLogRecord] = []
        self.data_pages: dict[int, Any] = {}
        self.lsn_counter: int = 0
        self.checkpoint_lsn: int = 0
        self.active_transactions: set[int] = set()

    def begin(self, transaction_id: int) -> None:
        self.active_transactions.add(transaction_id)

    def write(
        self, transaction_id: int, page_id: int, old_val: int, new_val: int
    ) -> int:
        log.info(
            f"Write: transaction_id={transaction_id}, page_id={page_id}, old_val={old_val}, new_val={new_val}"
        )
        self.lsn_counter += 1
        record = WalLogRecord(
            lsn=self.lsn_counter,
            page_id=page_id,
            old_val=old_val,
            new_val=new_val,
        )
        self.logger_buffer.append(record)
        return record.lsn

    def commit(self, transaction_id: int, lsn: int) -> None:
        log.info(f"Commit: transaction_id={transaction_id}, lsn={lsn}")
        self.log_files.extend(self.logger_buffer)
        for record in self.logger_buffer:
            if record.lsn <= lsn:
                record.committed = True
        self.logger_buffer.clear()
        self.active_transactions.discard(transaction_id)

    def modify_pages(self, page_id: int, new_val: int) -> None:
        self.data_pages[page_id] = new_val

    def checkpoint(self) -> None:
        if self.log_files and len(self.log_files) > 0:
            self.checkpoint_lsn = max(r.lsn for r in self.log_files if r.committed)
        log.info(f"Checkpoint: lsn={self.checkpoint_lsn}")

    def crash(self) -> List[WalLogRecord]:
        lost_pages = dict(self.data_pages)
        self.data_pages.clear()
        self.logger_buffer.clear()
        self.active_transactions.clear()
        print(f"CRASH! Data pages lost: {lost_pages}")
        return self.log_files

    def recover(self, records: List[WalLogRecord]) -> None:
        log.info(f"Recovering from {len(records)} log records")
        for record in records:
            if record.lsn <= self.checkpoint_lsn and not record.committed:
                continue
            self.data_pages[record.page_id] = record.new_val
            log.info(
                f"Recovered: lsn={record.lsn}, page_id={record.page_id}, new_val={record.new_val}"
            )

    def status(self) -> None:
        log.info(
            f"Status: checkpoint_lsn={self.checkpoint_lsn}, data_pages={self.data_pages}"
        )


def main() -> None:
    db = WAL()
    db.begin(1)
    lsn1 = db.write(1, page_id=5, old_val=0, new_val=100)
    db.commit(1, lsn1)
    db.modify_pages(5, 100)

    db.begin(2)
    lsn2 = db.write(2, page_id=5, old_val=100, new_val=200)
    db.commit(2, lsn2)
    db.modify_pages(5, 200)

    print("Before checkpoint:")
    db.status()

    db.checkpoint()

    db.begin(3)
    lsn3 = db.write(3, page_id=5, old_val=200, new_val=300)
    db.commit(3, lsn3)
    db.modify_pages(5, 300)

    print("\nBefore crash:")
    db.status()

    log = db.crash()
    db.recover(log)

    print("\nAfter recovery:")
    db.status()


if __name__ == "__main__":
    main()
