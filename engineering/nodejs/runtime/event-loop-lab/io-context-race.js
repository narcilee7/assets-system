const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('A. setTimeout'), 0);
  setImmediate(() => console.log('B. setImmediate'));
  process.nextTick(() => console.log('C. nextTick'));
});
