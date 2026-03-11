import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { ApiException } from '../../../common/exceptions/api.exception';

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

@Injectable()
export class GoogleOAuthService {
  private client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId || clientId === 'your_google_client_id') {
      console.warn(
        '⚠️  GOOGLE_CLIENT_ID is not configured. Google OAuth will not work.',
      );
      return;
    }
    this.client = new OAuth2Client(clientId);
  }

  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new ApiException(
          'AUTH.GOOGLE.INVALID_TOKEN',
          'Google ID token không hợp lệ',
          401,
          'Xác thực Google thất bại',
        );
      }

      return {
        googleId: payload.sub,
        email: payload.email || '',
        name: payload.name || '',
        picture: payload.picture,
        emailVerified: payload.email_verified || false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ApiException(
        'AUTH.GOOGLE.VERIFICATION_FAILED',
        'Không thể xác thực Google ID token: ' + errorMessage,
        401,
        'Xác thực Google thất bại',
      );
    }
  }
}
