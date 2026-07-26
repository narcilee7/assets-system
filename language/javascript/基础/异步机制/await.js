async function test() {
  console.log("A");
  await Promise.resolve();
  // 放到微任务队列
  console.log("B");
}

test();
console.log("C");
