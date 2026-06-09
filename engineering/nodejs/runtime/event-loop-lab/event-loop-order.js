console.log('1. script start');

setTimeout(() => console.log('2. setTimeout 0'), 0);
setImmediate(() => console.log('3. setImmediate'));
process.nextTick(() => console.log('4. nextTick'));
Promise.resolve().then(() => console.log('5. Promise microtask'));

console.log('6. script end');
