const { Transform } = require('stream');

const lineParser = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) this.push(JSON.parse(line));
    }
    callback();
  },
});

module.exports = { lineParser };
