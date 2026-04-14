import { Module } from '@nestjs/common';
import { MailsService } from './mails.service';
import { MailService } from './mail.service';
import { MockSmsService } from './sms.service';

@Module({
  providers: [MailsService, MailService],
  exports: [MailsService, MailService],
})
export class MailsModule {}
