import { Injectable, Logger } from '@nestjs/common';

export interface ISmsService {
  sendOtp(phone: string, otp: string): Promise<void>;
}

@Injectable()
export class MockSmsService implements ISmsService {
  private readonly logger = new Logger(MockSmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    // Mock implementation - log OTP to console
    this.logger.log('='.repeat(60));
    this.logger.log('📱 MOCK SMS SERVICE - OTP SENT');
    this.logger.log('='.repeat(60));
    this.logger.log(`Phone: ${phone}`);
    this.logger.log(`OTP Code: ${otp}`);
    this.logger.log(`Expires in: 5 minutes`);
    this.logger.log('='.repeat(60));

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
