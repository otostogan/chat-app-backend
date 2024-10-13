import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from './prisma.service';

interface User {
  id: string; // Unique identifier for the user, can be username or client ID
  username: string;
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private activeUsers: User[] = []; // Array to keep track of active users

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const username = client.handshake.query.username as string; // Get username from query
    this.activeUsers.push({ id: client.id, username });

    // Notify all clients of the updated active users
    this.server.emit('activeUsers', this.activeUsers);

    // Fetch message history and send it to the new client
    const messages = await this.prisma.message.findMany({
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    client.emit('history', messages);
  }

  async handleDisconnect(client: Socket) {
    // Remove user from active users list
    this.activeUsers = this.activeUsers.filter((user) => user.id !== client.id);

    // Notify all clients of the updated active users
    this.server.emit('activeUsers', this.activeUsers);
  }

  @SubscribeMessage('message')
  async handleMessage(
    client: Socket,
    payload: { username: string; content: string },
  ) {
    const newMessage = await this.prisma.message.create({
      data: {
        content: payload.content,
        user: {
          connectOrCreate: {
            where: { username: payload.username },
            create: { username: payload.username },
          },
        },
      },
      include: { user: true },
    });
    this.server.emit('message', newMessage); // Broadcast new message to all clients
  }
}
