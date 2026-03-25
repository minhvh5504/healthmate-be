import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { ApiException } from 'src/common/exceptions/api.exception';

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

@Injectable()
export class GoogleOAuthService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) return;

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        '⚠️  Firebase Admin credentials not configured. Google OAuth will not work.',
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);

      return {
        googleId: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? '',
        picture: decoded.picture,
        emailVerified: decoded.email_verified ?? false,
      };
    } catch (error) {
      if (error instanceof ApiException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ApiException(
        'AUTH.GOOGLE.VERIFICATION_FAILED',
        `Unable to verify Firebase ID token: ${errorMessage}`,
        401,
        'Google authentication failed',
      );
    }
  }
}
