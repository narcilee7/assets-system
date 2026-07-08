import asyncio


async def say_hello():
    await asyncio.sleep(1)
    print("Hello")


asyncio.run(say_hello())


async def concurrent_tasks():
    task1 = asyncio.create_task(say_hello())
    task2 = asyncio.create_task(say_hello())
    await asyncio.gather(task1, task2)


async def with_timeout():
    try:
        await asyncio.wait_for(say_hello(), timeout=0.5)
    except asyncio.TimeoutError:
        print("Timeout")


async def cancellable_task():
    try:
        while True:
            print("Working...")
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("Cancelled")
        pass
