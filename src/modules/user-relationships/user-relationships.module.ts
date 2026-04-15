import { Module } from '@nestjs/common';
import { UserRelationshipsService } from './user-relationships.service';
import { UserRelationshipsController } from './user-relationships.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [UserRelationshipsController],
  providers: [UserRelationshipsService],
  exports: [UserRelationshipsService],
})
export class UserRelationshipsModule {}
