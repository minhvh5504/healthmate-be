import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { CloudflareAdapter } from './cloudflare.adapter';
import { MedicationTool } from './tools/medication.tool';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, CloudflareAdapter, MedicationTool],
})
export class AiModule {}
