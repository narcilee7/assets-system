function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

console.time('single-thread');
const results = [35, 35, 35, 35].map(fib);
console.log(results);
console.timeEnd('single-thread');
