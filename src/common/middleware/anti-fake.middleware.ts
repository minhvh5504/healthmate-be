import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// Extend Express Request interface
interface RequestWithAntiFake extends Request {
  deviceFingerprint?: string;
  ipAddress?: string;
}

@Injectable()
export class AntiFakeMiddleware implements NestMiddleware {
  private rateLimitStore: RateLimitStore = {};
  private readonly maxRequests = 10; // Max requests per window
  private readonly windowMs = 60 * 1000; // 1 minute window

  use(req: RequestWithAntiFake, res: Response, next: NextFunction) {
    // Extract device fingerprint and IP
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // Create unique key for rate limiting
    const rateLimitKey = deviceFingerprint || ipAddress;

    // Check rate limit
    const now = Date.now();
    const rateLimit = this.rateLimitStore[rateLimitKey];

    if (!rateLimit || now > rateLimit.resetTime) {
      // Initialize or reset rate limit
      this.rateLimitStore[rateLimitKey] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
    } else {
      // Increment count
      rateLimit.count++;

      if (rateLimit.count > this.maxRequests) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Attach fingerprint and IP to request for order creation
    req.deviceFingerprint = deviceFingerprint;
    req.ipAddress = ipAddress;

    next();
  }

  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    Object.keys(this.rateLimitStore).forEach((key) => {
      if (now > this.rateLimitStore[key].resetTime) {
        delete this.rateLimitStore[key];
      }
    });
  }
}
