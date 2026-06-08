const http = require('http');
const { WorkerPool } = require('../../runtime/worker-threads/worker-pool');

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

const pool = new WorkerPool('../../runtime/worker-threads/fib-worker.js', 4);

const server = http.createServer(async (req, res) => {
  if (req.url === '/blocking') {
    const result = fib(40);
    res.end(JSON.stringify({ result }));
  } else if (req.url === '/worker') {
    const result = await pool.execute(40);
    res.end(JSON.stringify({ result }));
  } else {
    res.end('ok');
  }
});

server.listen(3000, () => console.log('Server on :3000'));
