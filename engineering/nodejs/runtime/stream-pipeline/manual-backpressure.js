const fs = require('fs');
const readable = fs.createReadStream('./large-file.txt');
const writable = fs.createWriteStream('./copy.txt');

readable.on('data', (chunk) => {
  const ok = writable.write(chunk);
  if (!ok) {
    readable.pause();
    writable.once('drain', () => readable.resume());
  }
});

readable.on('end', () => writable.end());
