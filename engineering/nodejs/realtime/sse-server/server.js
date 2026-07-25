import { Request, Response } from 'express';

class SSEService {
  clients = new Map();
  messageHistory = [];
  historyLimit = 100;
  nextId = 1;

  subscribe(req, res) {
    const clientId = crypto.randomUUID();
    const lastId = Number(req.headers["last-event-id"] || 0);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const missed = this.messageHistory.filter(m => m.id > lastId);
    for (const msg of missed) {
      this._writeMessage(res, msg);
    }

    const client = {
      id: clientId,
      res,
      lastEventId: lastId,
    };

    this.clients.set(clientId, client);

    req.on('close', () => {
      this.clients.delete(clientId);
    })

    const heartbeat = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(heartbeat);
        return;
      }
      res.write(':heartbeat\n\n');
    }, 30000);
  }

  broadcast(event, data) {
    const msg = {
      id: this.nextId++,
      event,
      data: JSON.stringify(data)
    };
    this.messageHistory.push(msg);
    if (this.messageHistory.length > this.historyLimit) {
      this.messageHistory.shift();
    }
    for (const client of this.clients.values()) {
      this._writeMessage(client.res, msg);
    }
  } 

  _writeMessage(res, msg) {
    res.write(`id: ${msg.id}\n`);
    if (msg.event) {
      res.write(`event: ${msg.event}\n`);
    }
    res.write(`data: ${msg.data}\n\n`);
  }
}

export const sseService = new SSEService();
