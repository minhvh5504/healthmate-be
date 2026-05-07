import { Roles } from 'src/common/decorators/roles.decorator';
import { Controller, Post, Body, UseGuards, Res, Get } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';
import { ChatMessage } from './cloudflare.adapter';

@ApiTags('AI Chat')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('history')
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Get chat history' })
  async getHistory(@CurrentUser('id') userId: string) {
    const history = await this.aiService.getHistory(userId);
    return {
      success: true,
      data: history,
    };
  }

  @Post('chat')
  @Roles(Role.admin, Role.user)
  @ApiOperation({ summary: 'Chat with AI (SSE stream)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Danh sách thuốc tôi đang dùng là gì?' },
        history: {
          type: 'array',
          example: [],
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', example: 'user' },
              content: { type: 'string', example: 'Chào bạn' },
            },
          },
        },
      },
    },
  })
  chatStream(
    @Body('history') history: ChatMessage[] = [],
    @Body('message') message: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const subscription = this.aiService.chatStream(history, message, userId).subscribe({
      next: (data: unknown) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      error: (e: unknown) => {
        const errMessage = e instanceof Error ? e.message : 'Unknown error';
        res.write(`data: ${JSON.stringify({ error: errMessage })}\n\n`);
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }
}
