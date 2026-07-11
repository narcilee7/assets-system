import asyncio
import logging
import time

logging.basicConfig(level=logging.WARNING, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("asyncio")

async def high_performance_io():
  while True:
    await asyncio.sleep(0.01)

async def silent_killer_cpu_bound():
  await asyncio.sleep(0.5)
  print("\n running sync block")
  time.sleep(0.2)
  print("🔥 阻塞操作结束")

if __name__ == "__main__":
  loop = asyncio.new_event_loop()
  asyncio.set_event_loop(loop)

  loop.set_debug(True)
  loop.slow_callback_duration = 0.1

  loop.create_task(high_performance_io())
  loop.create_task(silent_killer_cpu_bound())

  try:
    loop.run_until_complete(asyncio.sleep(1.0))
  finally:
    loop.close()
