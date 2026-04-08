import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automatically delete expired verification codes every minute
   * (Commented out because VerificationCode table was removed)
   */
  // @Cron(CronExpression.EVERY_MINUTE)
  // async cleanupExpiredVerificationCodes() {
  //   this.logger.log('Cleaning up expired verification codes...');
  //   
  //   try {
  //     const result = await this.prisma.verificationCode.deleteMany({
  //       where: {
  //         expiresAt: {
  //           lt: new Date(),
  //         },
  //       },
  //     });
  //     
  //     if (result.count > 0) {
  //       this.logger.log(`Successfully deleted ${result.count} expired verification codes.`);
  //     }
  //   } catch (error) {
  //     this.logger.error('Error cleaning up verification codes:', error);
  //   }
  // }

  /**
   * Cleanup expired refresh tokens once a day
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredRefreshTokens() {
    this.logger.log('Cleaning up expired refresh tokens...');
    
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      
      if (result.count > 0) {
        this.logger.log(`Successfully deleted ${result.count} expired refresh tokens.`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up refresh tokens:', error);
    }
  }
}
