const fs = require('fs');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');

async function run() {
  await pipeline(
    fs.createReadStream('./input.txt'),
    zlib.createGzip(),
    fs.createWriteStream('./input.txt.gz')
  );
  console.log('Pipeline succeeded');
}

run().catch(console.error);
