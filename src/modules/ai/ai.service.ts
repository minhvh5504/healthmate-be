import { Injectable, Logger } from '@nestjs/common';
import { CloudflareAdapter, AiTool, ChatMessage } from './cloudflare.adapter';
import { MedicationTool } from './tools/medication.tool';
import { Observable, Subscriber } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly cloudflareAdapter: CloudflareAdapter,
    private readonly medicationTool: MedicationTool,
    private readonly prisma: PrismaService,
  ) {}

  async getHistory(userId: string) {
    return await this.prisma.aiMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  chatStream(
    historyMessages: ChatMessage[],
    userMessage: string,
    userId: string,
  ): Observable<unknown> {
    return new Observable((subscriber: Subscriber<unknown>) => {
      // Save user message immediately (fire and forget for streaming speed)
      this.prisma.aiMessage
        .create({
          data: { userId, role: 'user', content: userMessage },
        })
        .catch((err) => this.logger.error('Failed to save user message:', err));

      const tools: AiTool[] = [this.medicationTool.getToolDefinition() as AiTool];

      const executeTool = async (name: string) => {
        this.logger.log(`Executing tool: ${name}`);
        if (name === 'get_user_medications') {
          return this.medicationTool.execute(userId);
        }
        return { error: `Tool ${name} not found` };
      };

      let fullContent = '';

      // Wrap subscriber to intercept the final assistant message and save it
      const interceptor = {
        next: (data: unknown) => {
          if (data && typeof data === 'object' && 'text' in data) {
            const aiData = data as { text: string };
            fullContent += aiData.text;
          }
          subscriber.next(data);
        },
        error: (err: any) => subscriber.error(err),
        complete: () => {
          if (fullContent) {
            this.prisma.aiMessage
              .create({
                data: { userId, role: 'assistant', content: fullContent },
              })
              .catch((err) => this.logger.error('Failed to save assistant message:', err));
          }
          subscriber.complete();
        },
      };

      void this.cloudflareAdapter.processChat(
        historyMessages,
        userMessage,
        interceptor as unknown as Subscriber<unknown>,
        tools,
        executeTool,
      );
    });
  }
}
