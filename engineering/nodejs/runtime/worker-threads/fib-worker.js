const { parentPort } = require('worker_threads');

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.on('message', (n) => {
  const result = fib(n);
  parentPort.postMessage(result);
});
