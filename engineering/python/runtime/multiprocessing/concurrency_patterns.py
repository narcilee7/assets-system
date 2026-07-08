import asyncio
import multiprocessing as mp
import threading
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from re import M
from this import s

import aiottp


# ThreadPoolExecutor (I/O-bound)
def thread_pool_executor():
    def fetch_url(url: str):
        import requests

        return requests.get(url).status_code

    urls = ["https://www.example.com", "https://www.google.com", "https://www.bing.com"]
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(fetch_url, urls))
        print(results)


def heavy_compute(n):
    return sum(i * i for i in range(n))


# ProcessPoolExecutor (CPU-bound)
def process_pool_executor():
    inputs = [1_000_000, 2_000_000, 3_000_000]
    with ProcessPoolExecutor(max_workers=10) as executor:
        results = list(
            executor.map(
                heavy_compute,
                inputs,
            )
        )
        print(results)


# Asyncio + ProcessPoolExecutor (CPU-bound)
async def hrbdrid_approach():
    loop = asyncio.get_event_loop()

    # I/O
    async with aiohttp.ClientSession() as session:
        async with session.get("https://www.example.com") as response:
            print(await response.text())

    # CPU-bound
    with ProcessPoolExecutor(max_workers=10) as executor:
        result = await loop.run_in_executor(executor, heavy_compute, 1_000_000)
        print(result)


def share_memory():
    from multiprocessing import Manager, Process

    def worker(d: dict, l: list):
        d["count"] += 1
        l.append(d["count"])

    manager = Manager()
    shared_dict = manager.dict()
    shared_dict["count"] = 0

    shared_list = manager.list()

    processes = []
    for _ in range(4):
        p = Process(target=worker, args=(shared_dict, shared_list))
        processes.append(p)
        p.start()

    for p in processes:
        p.join()

    print(f"Count: {shared_dict['count']}")
    print(f"List: {list(shared_list)}")


# 进程间通信
def process_communication():
    queue = mp.Queue()
    queue.put("message")
    msg = queue.get()
    print(msg)

    # Pipe
    parrent_conn, child_conn = mp.Pipe()
    child_conn.send("hello")
    msg = parrent_conn.recv()
    print(msg)

    # Lock
    lock = mp.Lock()
    with lock:
        pass
