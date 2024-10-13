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
  id: string;
  username: string;
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private activeUsers: User[] = [];

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    console.log(client.handshake);
    const username = client.handshake.query.username as string;
    this.activeUsers.push({ id: client.id, username });

    this.server.emit('activeUsers', this.activeUsers);

    const messages = await this.prisma.message.findMany({
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    client.emit('history', messages);

    this.server.emit('message', {
      user: { username: username },
      content: `${username} has joined the chat!`,
    });
  }

  async handleDisconnect(client: Socket) {
    const user = this.activeUsers.find((user) => user.id === client.id);
    console.log(this.activeUsers);
    if (user) {
      this.activeUsers = this.activeUsers.filter((u) => u.id !== client.id);

      this.server.emit('activeUsers', this.activeUsers);

      this.server.emit('message', {
        user: { username: user.username },
        content: `${user.username} has left the chat.`,
      });
    }
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
    this.server.emit('message', newMessage);
  }
}
