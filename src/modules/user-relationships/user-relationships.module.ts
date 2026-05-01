import { Module } from '@nestjs/common';
import { UserRelationshipsService } from './user-relationships.service';
import { UserRelationshipsController } from './user-relationships.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailsModule } from '../mails/mails.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MailsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [UserRelationshipsController],
  providers: [UserRelationshipsService],
  exports: [UserRelationshipsService],
})
export class UserRelationshipsModule {}
