import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { RoomService } from './room-service';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify(roomService.getStats()));
  }
});

const wss = new WebSocketServer({ server });
const roomService = new RoomService(wss);

server.listen(3000, () => console.log('WebSocket room server on 3000'));
