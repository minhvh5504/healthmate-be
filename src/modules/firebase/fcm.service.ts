import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface FcmPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  /**
   * Send a push notification to a single FCM token (FCM V1)
   */
  async sendPush(payload: FcmPayload): Promise<void> {
    if (!payload.token) return;

    try {
      await admin.messaging().send({
        token: payload.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ?? {},
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'healthmate_notifications',
          },
        },
      });
      this.logger.debug(`FCM sent to token ...${payload.token.slice(-10)}`);
    } catch (error) {
      // Invalid or expired token - log but don't crash the app
      this.logger.error(`FCM send failed: ${(error as Error).message}`);
    }
  }

  /**
   * Send push notifications to multiple tokens at once (fan-out)
   */
  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!tokens.length) return;

    const messages: admin.messaging.Message[] = tokens.map((token) => ({
      token,
      notification: { title, body },
      data: data ?? {},
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
      android: {
        priority: 'high' as const,
        notification: { sound: 'default', channelId: 'healthmate_notifications' },
      },
    }));

    try {
      const response = await admin.messaging().sendEach(messages);
      this.logger.debug(
        `FCM multicast: ${response.successCount} success, ${response.failureCount} fail`,
      );
    } catch (error) {
      this.logger.error(`FCM multicast failed: ${(error as Error).message}`);
    }
  }
}
