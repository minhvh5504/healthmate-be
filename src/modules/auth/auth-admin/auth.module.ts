import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthAdminService } from './auth.service';
import { AuthAdminController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { JwtAdminStrategy } from './strategies/jwt.strategy';
import type { StringValue } from 'ms';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') as StringValue,
        },
      }),
    }),
  ],
  providers: [AuthAdminService, JwtAdminStrategy],
  controllers: [AuthAdminController],
  exports: [AuthAdminService],
})
export class AuthAdminModule {}
