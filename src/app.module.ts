import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth-user/auth.module';
import { AuthAdminModule } from './modules/auth/auth-admin/auth.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationTimeSlotsModule } from './modules/notification-time-slots/notification-time-slots.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ProfileModule } from './modules/profile/profile.module';
import { MedicationModule } from './modules/medication/medication.module';
import { RedisModule } from './modules/redis/redis.module';
import { UserMedicationModule } from './modules/user-medication/user-medication.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MailsModule } from './modules/mails/mails.module';
import { UserRelationshipsModule } from './modules/user-relationships/user-relationships.module';
import { MedicationConditionsModule } from './modules/medication-conditions/medication-conditions.module';
import { ReminderSchedulesModule } from './modules/reminder-schedules/reminder-schedules.module';
import { MedicationLogsModule } from './modules/medication-logs/medication-logs.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { AiModule } from './modules/ai/ai.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    // // Throttler for rate limiting
    // ThrottlerModule.forRoot([
    //   {
    //     ttl: 60000, // 1 minute
    //     limit: 10, // 10 requests per minute
    //   },
    // ]),

    // Global modules
    PrismaModule,
    RedisModule,
    FirebaseModule,

    // Feature modules
    AuthModule,
    AuthAdminModule,
    UploadModule,
    RealtimeModule,
    NotificationTimeSlotsModule,
    ProfileModule,
    MedicationModule,
    UserMedicationModule,
    NotificationsModule,
    MailsModule,
    UserRelationshipsModule,
    MedicationConditionsModule,
    ReminderSchedulesModule,
    MedicationLogsModule,
    StatisticsModule,
    AiModule,
    PrescriptionsModule,
  ],
  providers: [
    // Global guard - apply JWT auth to all routes by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global throttler guard for rate limiting
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // Apply anti-fake middleware to order creation endpoint
    // consumer.apply(AntiFakeMiddleware).forRoutes('orders');
  }
}
