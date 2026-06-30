import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrescriptionsService } from './prescriptions.service';

@Injectable()
export class PrescriptionStatusSchedulerService {
  private readonly logger = new Logger(PrescriptionStatusSchedulerService.name);

  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Cron('5 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async completeExpiredPrescriptions() {
    const result = await this.prescriptionsService.completeExpiredPrescriptions();

    if (result.count > 0) {
      this.logger.log(`Completed ${result.count} expired prescriptions`);
    }
  }
}
