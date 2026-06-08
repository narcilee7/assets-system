/**
 * Event Loop 自举实现 - 验证 Demo
 * 
 * 运行方式：node demo.js
 * 
 * 每个 demo 都会先替换全局 API 为自举实现，然后执行测试代码。
 * 输出应与真实 Node.js Event Loop 的行为高度一致。
 */

const { bootstrapEventLoop, simulateIO } = require('./event-loop');

// 工具：等待一段时间让 event loop 处理完毕
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// =============================================================================
// Demo 1: 基础时序验证
// =============================================================================
async function demo1_basicOrdering() {
  console.log('\n========== Demo 1: Basic Ordering ==========');
  console.log('Expected: script start → script end → nextTick → Promise → setTimeout(0) → setImmediate');
  console.log('');

  bootstrapEventLoop({ debug: true, maxTicks: 10 });

  console.log('1. script start');

  setTimeout(() => console.log('2. setTimeout 0'), 0);
  setImmediate(() => console.log('3. setImmediate'));
  process.nextTick(() => console.log('4. nextTick'));
  Promise.resolve().then(() => console.log('5. Promise microtask'));

  console.log('6. script end');

  await sleep(100);
}

// =============================================================================
// Demo 2: I/O 上下文中的 setTimeout vs setImmediate
// =============================================================================
async function demo2_ioContextRace() {
  console.log('\n========== Demo 2: I/O Context Race ==========');
  console.log('Expected: nextTick → setImmediate → setTimeout (in I/O callback)');
  console.log('');

  bootstrapEventLoop({ debug: true, maxTicks: 10 });

  simulateIO(() => {
    console.log('A. I/O callback entered');
    setTimeout(() => console.log('B. setTimeout'), 0);
    setImmediate(() => console.log('C. setImmediate'));
    process.nextTick(() => console.log('D. nextTick'));
  });

  await sleep(100);
}

// =============================================================================
// Demo 3: nextTick 饥饿风险
// =============================================================================
async function demo3_nextTickStarvation() {
  console.log('\n========== Demo 3: nextTick Starvation ==========');
  console.log('Expected: nextTick 1-3 → setTimeout should not starve');
  console.log('');

  bootstrapEventLoop({ debug: true, maxTicks: 15 });

  let count = 0;
  function busyNextTick() {
    if (count++ < 3) {
      process.nextTick(() => {
        console.log(`nextTick ${count}`);
        busyNextTick();
      });
    }
  }
  busyNextTick();

  setTimeout(() => console.log('setTimeout: finally got a chance!'), 0);

  await sleep(100);
}

// =============================================================================
// Demo 4: 嵌套 Promise + nextTick 的 drain 规则
// =============================================================================
async function demo4_nestedDrain() {
  console.log('\n========== Demo 4: Nested Drain Rules ==========');
  console.log('Expected: nextTick before Promise, and nested promises drain recursively');
  console.log('');

  bootstrapEventLoop({ debug: true, maxTicks: 10 });

  Promise.resolve().then(() => {
    console.log('Promise 1');
    process.nextTick(() => console.log('nextTick inside Promise 1'));
    Promise.resolve().then(() => console.log('Promise 2'));
  });

  process.nextTick(() => {
    console.log('nextTick 1');
    Promise.resolve().then(() => console.log('Promise inside nextTick'));
  });

  await sleep(100);
}

// =============================================================================
// Demo 5: setInterval + clearTimeout
// =============================================================================
async function demo5_intervalAndClear() {
  console.log('\n========== Demo 5: setInterval & clearTimeout ==========');
  console.log('Expected: tick 1, tick 2, then cleared, no tick 3');
  console.log('');

  bootstrapEventLoop({ debug: false, maxTicks: 10 });

  let count = 0;
  const timerId = setInterval(() => {
    count++;
    console.log(`Interval tick ${count}`);
    if (count >= 2) {
      clearInterval(timerId);
      console.log('Interval cleared');
    }
  }, 10);

  await sleep(100);
}

// =============================================================================
// Demo 6: 复杂混合场景（综合验证）
// =============================================================================
async function demo6_complexScenario() {
  console.log('\n========== Demo 6: Complex Mixed Scenario ==========');
  console.log('综合验证所有 queue 的交互顺序');
  console.log('');

  bootstrapEventLoop({ debug: true, maxTicks: 15 });

  console.log('script start');

  setTimeout(() => {
    console.log('timer 1');
    process.nextTick(() => console.log('nextTick inside timer 1'));
  }, 0);

  setTimeout(() => {
    console.log('timer 2');
  }, 0);

  setImmediate(() => {
    console.log('immediate 1');
  });

  simulateIO(() => {
    console.log('io callback');
    setImmediate(() => console.log('immediate inside io'));
    setTimeout(() => console.log('timer inside io'), 0);
  });

  Promise.resolve().then(() => console.log('promise 1'));
  process.nextTick(() => console.log('nextTick 1'));

  console.log('script end');

  await sleep(150);
}

// =============================================================================
// 主入口：运行所有 Demo
// =============================================================================
async function main() {
  await demo1_basicOrdering();
  await demo2_ioContextRace();
  await demo3_nextTickStarvation();
  await demo4_nestedDrain();
  await demo5_intervalAndClear();
  await demo6_complexScenario();

  console.log('\n========== All Demos Completed ==========');
  process.exit(0);
}

main().catch(console.error);
