import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from './prisma.service';

@Module({
  providers: [ChatGateway, PrismaService],
})
export class AppModule {}
