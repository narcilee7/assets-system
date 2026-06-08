# Python Distributed ID

分布式 ID 生成方案：雪花算法、UUID、数据库自增。

## 雪花算法（Snowflake）

```python
# snowflake.py
import time
import threading

class Snowflake:
    def __init__(self, datacenter_id: int, worker_id: int):
        self.datacenter_id = datacenter_id
        self.worker_id = worker_id
        self.sequence = 0
        self.last_timestamp = -1
        self.lock = threading.Lock()
        
        # 位数分配
        self.worker_id_bits = 5
        self.datacenter_id_bits = 5
        self.sequence_bits = 12
        
        self.max_worker_id = -1 ^ (-1 << self.worker_id_bits)
        self.max_datacenter_id = -1 ^ (-1 << self.datacenter_id_bits)
        self.sequence_mask = -1 ^ (-1 << self.sequence_bits)
        
        self.worker_id_shift = self.sequence_bits
        self.datacenter_id_shift = self.sequence_bits + self.worker_id_bits
        self.timestamp_left_shift = self.sequence_bits + self.worker_id_bits + self.datacenter_id_bits
        self.epoch = 1288834974657  # Twitter 起始时间
    
    def _current_timestamp(self):
        return int(time.time() * 1000)
    
    def _til_next_millis(self, last_timestamp):
        timestamp = self._current_timestamp()
        while timestamp <= last_timestamp:
            timestamp = self._current_timestamp()
        return timestamp
    
    def generate(self) -> int:
        with self.lock:
            timestamp = self._current_timestamp()
            
            if timestamp < self.last_timestamp:
                raise Exception("Clock moved backwards")
            
            if timestamp == self.last_timestamp:
                self.sequence = (self.sequence + 1) & self.sequence_mask
                if self.sequence == 0:
                    timestamp = self._til_next_millis(self.last_timestamp)
            else:
                self.sequence = 0
            
            self.last_timestamp = timestamp
            
            return ((timestamp - self.epoch) << self.timestamp_left_shift) | \
                   (self.datacenter_id << self.datacenter_id_shift) | \
                   (self.worker_id << self.worker_id_shift) | \
                   self.sequence

# 使用
sf = Snowflake(datacenter_id=1, worker_id=1)
id = sf.generate()
```

## ULID（排序友好的 UUID）

```python
from ulid import ULID

id = ULID()  # 基于时间排序
print(id)    # 01ARZ3NDEKTSV4RRFFQ69G5FAV
```
