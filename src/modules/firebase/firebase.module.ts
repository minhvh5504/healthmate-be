import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FcmService } from './fcm.service';

@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_APP',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Reuse existing app if already initialized (e.g. from GoogleOAuthService)
        if (admin.apps.length > 0) return admin.apps[0]!;

        const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = configService
          .get<string>('FIREBASE_PRIVATE_KEY', '')
          .replace(/\\n/g, '\n');

        return admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
      },
    },
    FcmService,
  ],
  exports: [FcmService],
})
export class FirebaseModule {}
