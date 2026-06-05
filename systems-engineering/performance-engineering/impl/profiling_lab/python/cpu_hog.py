#!/usr/bin/env python3
"""Simple CPU-bound HTTP server for profiling demo."""

import http.server
import socketserver
import time


def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/work":
            start = time.perf_counter()
            result = fib(38)
            duration = time.perf_counter() - start
            body = f"result={result} duration={duration:.3f}s\n".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # suppress default logging


if __name__ == "__main__":
    PORT = 8080
    print(f"Listening on :{PORT}")
    print("Profile workflow:")
    print("  1. python -m cProfile -o stats.prof cpu_hog.py")
    print("  2. curl http://localhost:8080/work")
    print("  3. Ctrl-C to stop server")
    print("  4. flameprof stats.prof > flame.svg")
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
