import { Module } from '@nestjs/common';
import { MailService } from './mails.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailsModule {}
