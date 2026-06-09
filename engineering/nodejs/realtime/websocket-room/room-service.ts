import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

interface Room {
  name: string;
  clients: Set<WebSocket>;
}

export class RoomService {
  private rooms = new Map<string, Room>();
  private clientRooms = new WeakMap<WebSocket, Set<string>>();
  private clientMetadata = new WeakMap<WebSocket, { userId: string; connectedAt: Date }>();

  constructor(private wss: WebSocketServer) {
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const userId = this.extractUserId(req);
    this.clientMetadata.set(ws, { userId, connectedAt: new Date() });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => this.handleDisconnect(ws));
    ws.send(JSON.stringify({ type: 'connected', userId }));
  }

  private handleMessage(ws: WebSocket, msg: any) {
    switch (msg.type) {
      case 'join':
        this.joinRoom(ws, msg.room);
        break;
      case 'leave':
        this.leaveRoom(ws, msg.room);
        break;
      case 'broadcast':
        this.broadcast(msg.room, { type: 'message', from: this.clientMetadata.get(ws)?.userId, data: msg.data });
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  joinRoom(ws: WebSocket, roomName: string) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, { name: roomName, clients: new Set() });
    }
    const room = this.rooms.get(roomName)!;
    room.clients.add(ws);

    let userRooms = this.clientRooms.get(ws);
    if (!userRooms) {
      userRooms = new Set();
      this.clientRooms.set(ws, userRooms);
    }
    userRooms.add(roomName);

    ws.send(JSON.stringify({ type: 'joined', room: roomName }));
  }

  leaveRoom(ws: WebSocket, roomName: string) {
    const room = this.rooms.get(roomName);
    if (room) {
      room.clients.delete(ws);
      if (room.clients.size === 0) this.rooms.delete(roomName);
    }
    this.clientRooms.get(ws)?.delete(roomName);
    ws.send(JSON.stringify({ type: 'left', room: roomName }));
  }

  broadcast(roomName: string, data: any, exclude?: WebSocket) {
    const room = this.rooms.get(roomName);
    if (!room) return;
    const message = JSON.stringify(data);
    for (const client of room.clients) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const rooms = this.clientRooms.get(ws);
    if (rooms) {
      for (const roomName of rooms) {
        this.leaveRoom(ws, roomName);
      }
    }
  }

  private extractUserId(req: IncomingMessage): string {
    const url = new URL(req.url || '/', 'http://localhost');
    return url.searchParams.get('userId') || 'anonymous';
  }

  getStats() {
    return {
      totalConnections: this.wss.clients.size,
      rooms: Array.from(this.rooms.entries()).map(([name, room]) => ({
        name,
        clients: room.clients.size,
      })),
    };
  }
}
