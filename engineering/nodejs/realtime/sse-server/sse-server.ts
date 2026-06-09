import { Request, Response } from 'express';

interface Client {
  id: string;
  res: Response;
  lastEventId: number;
}

class SSEService {
  private clients = new Map<string, Client>();
  private messageHistory: { id: number; event?: string; data: string }[] = [];
  private historyLimit = 100;
  private nextId = 1;

  subscribe(req: Request, res: Response) {
    const clientId = crypto.randomUUID();
    const lastId = Number(req.headers['last-event-id'] || 0);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const missed = this.messageHistory.filter((m) => m.id > lastId);
    for (const msg of missed) {
      this.writeMessage(res, msg);
    }

    const client: Client = { id: clientId, res, lastEventId: lastId };
    this.clients.set(clientId, client);

    req.on('close', () => {
      this.clients.delete(clientId);
    });

    const heartbeat = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(heartbeat);
        return;
      }
      res.write(':heartbeat\n\n');
    }, 30000);
  }

  broadcast(event: string, data: any) {
    const message = { id: this.nextId++, event, data: JSON.stringify(data) };
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.historyLimit) {
      this.messageHistory.shift();
    }

    for (const client of this.clients.values()) {
      this.writeMessage(client.res, message);
    }
  }

  private writeMessage(res: Response, msg: { id: number; event?: string; data: string }) {
    res.write(`id: ${msg.id}\n`);
    if (msg.event) res.write(`event: ${msg.event}\n`);
    res.write(`data: ${msg.data}\n\n`);
  }
}

export const sseService = new SSEService();
