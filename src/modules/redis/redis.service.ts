import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/constants/redis.constants';

export enum OtpType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Set OTP code with expiration
   */
  async setOtp(
    userId: string,
    code: string,
    type: OtpType,
    ttlSeconds: number = 300,
  ): Promise<void> {
    const key = `otp:${type}:${userId}`;
    await this.redis.set(key, code, 'EX', ttlSeconds);
  }

  /**
   * Get OTP code
   */
  async getOtp(userId: string, type: OtpType): Promise<string | null> {
    const key = `otp:${type}:${userId}`;
    return this.redis.get(key);
  }

  /**
   * Delete OTP code
   */
  async deleteOtp(userId: string, type: OtpType): Promise<void> {
    const key = `otp:${type}:${userId}`;
    await this.redis.del(key);
  }

  /**
   * Generic set with expiration
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Generic get
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Generic del
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
