import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

/**
 * Minimal CPU-bound HTTP server for profiling demos.
 *
 * Recommended profiler: async-profiler (https://github.com/jvm-profiling-tools/async-profiler)
 *
 * Quick start:
 *   javac CpuHog.java
 *   java -XX:+PreserveFramePointer CpuHog
 *   # In another terminal:
 *   ./profiler.sh -d 10 -f flame.svg $(pgrep java)
 */
public class CpuHog {
    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/work", new WorkHandler());
        server.setExecutor(null);
        server.start();
        System.out.println("Listening on :8080");
        System.out.println("async-profiler example:");
        System.out.println("  ./profiler.sh -d 10 -f flame.svg $(pgrep -f CpuHog)");
    }

    static class WorkHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            long start = System.currentTimeMillis();
            int result = fib(38);
            long duration = System.currentTimeMillis() - start;
            String response = String.format("result=%d duration=%dms%n", result, duration);
            exchange.sendResponseHeaders(200, response.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }
    }

    static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }
}
