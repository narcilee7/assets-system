/**
 * 手写 mini SSE server
 *
 * 考点：
 * - Server-Sent Events 协议：text/event-stream、data:、event:、id:、retry:。
 * - 连接管理、心跳保活、广播。
 */

import { IncomingMessage, ServerResponse } from "node:http";

export interface SSEMessage {
  event?: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export class MiniSSE {
  private clients = new Set<ServerResponse>();
  private heartbeatInterval?: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: { heartbeatInterval?: number } = {}) {
    this.heartbeatInterval = options.heartbeatInterval;
  }

  connect(_req: IncomingMessage, res: ServerResponse): () => void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(":ok\n\n");
    this.clients.add(res);

    const cleanup = () => this.clients.delete(res);
    res.on("close", cleanup);

    if (this.heartbeatInterval && !this.timer) {
      this.timer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
    }

    return cleanup;
  }

  send(message: SSEMessage): void {
    const payload = this.serialize(message);
    for (const res of this.clients) {
      res.write(payload);
    }
  }

  broadcast(event: string, data: unknown): void {
    this.send({ event, data });
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const res of this.clients) {
      res.end();
    }
    this.clients.clear();
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private serialize(message: SSEMessage): string {
    let lines = "";
    if (message.event) lines += `event: ${message.event}\n`;
    const data = typeof message.data === "string" ? message.data : JSON.stringify(message.data);
    for (const line of data.split("\n")) {
      lines += `data: ${line}\n`;
    }
    if (message.id) lines += `id: ${message.id}\n`;
    if (message.retry !== undefined) lines += `retry: ${message.retry}\n`;
    lines += "\n";
    return lines;
  }

  private sendHeartbeat(): void {
    for (const res of this.clients) {
      res.write(":heartbeat\n\n");
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sse = new MiniSSE();
  console.log("sse created");
}
