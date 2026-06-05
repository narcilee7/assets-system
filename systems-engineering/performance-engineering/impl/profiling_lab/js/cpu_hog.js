import http from "http";

function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

const server = http.createServer((req, res) => {
  if (req.url === "/work") {
    const start = Date.now();
    const result = fib(38);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`result=${result} duration=${Date.now() - start}ms\n`);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(8080, () => {
  console.log("Listening on :8080");
  console.log("Profile workflow:");
  console.log("  1. node --prof cpu_hog.js   (or npx tsx cpu_hog.ts)");
  console.log("  2. curl http://localhost:8080/work");
  console.log("  3. node --prof-process isolate-*.log > profile.txt");
  console.log("Or use 0x: npx 0x cpu_hog.js");
});
