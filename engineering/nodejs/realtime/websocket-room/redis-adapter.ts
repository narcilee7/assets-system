import { Redis } from 'ioredis';
import { RoomService } from './room-service';

const pub = new Redis();
const sub = new Redis();

export function attachRedisAdapter(roomService: RoomService) {
  sub.psubscribe('ws:room:*');
  sub.on('pmessage', (_pattern, channel, message) => {
    const roomName = channel.replace('ws:room:', '');
    roomService.broadcast(roomName, JSON.parse(message));
  });
}

export function publishToRoom(roomName: string, data: any) {
  pub.publish(`ws:room:${roomName}`, JSON.stringify(data));
}
