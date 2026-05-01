import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRelationshipsService } from './user-relationships.service';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InviteUserDto } from './dto/invite-user.dto';
import { Public } from '../../common/decorators/public.decorator';

import { ConfigService } from '@nestjs/config';

@ApiTags('User Relationships')
@Controller('user-relationships')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserRelationshipsController {
  constructor(
    private readonly relationshipsService: UserRelationshipsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('invite')
  @ApiOperation({ summary: 'Send an invitation to another user' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  invite(@CurrentUser('id') userId: string, @Body() inviteDto: InviteUserDto) {
    return this.relationshipsService.invite(userId, inviteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all relationships (invitations sent and received)' })
  findAll(@CurrentUser('id') userId: string) {
    return this.relationshipsService.findAll(userId);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept a pending invitation' })
  accept(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.relationshipsService.accept(id, userId);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke an existing relationship' })
  revoke(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.relationshipsService.revoke(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a relationship' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.relationshipsService.remove(id, userId);
  }

  @Public()
  @Get('accept-token')
  @ApiOperation({ summary: 'Accept a relationship via magic token from email (browser redirect)' })
  async acceptByToken(@Query('token') token: string, @Res() res: Response) {
    const deepLinkBase = this.configService.get<string>('DEEP_LINK_URL');

    if (!token) {
      return res.redirect(`${deepLinkBase}?status=error&reason=missing_token`);
    }

    try {
      await this.relationshipsService.acceptByToken(token);
      return res.redirect(`${deepLinkBase}?status=success&token=${token}`);
    } catch (e) {
      const error = e as { name?: string; message?: string; status?: number };
      let reason = 'unknown';
      if (error?.name === 'TokenExpiredError' || error?.message?.includes('TOKEN_EXPIRED')) {
        reason = 'expired';
      } else if (error?.message?.includes('INVALID_TOKEN') || error?.name === 'JsonWebTokenError') {
        reason = 'invalid';
      } else if (error?.message?.includes('NOT_FOUND') || error?.status === 404) {
        reason = 'not_found';
      } else if (error?.message?.includes('ALREADY_EXISTS')) {
        return res.redirect(`${deepLinkBase}?status=success&token=${token}`);
      }

      return res.redirect(`${deepLinkBase}?status=error&reason=${reason}`);
    }
  }

  @Public()
  @Post('accept-by-token')
  @ApiOperation({ summary: 'Accept a relationship via token (mobile JSON API — no redirect)' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptByTokenMobile(@Body() body: { token: string }) {
    if (!body?.token) {
      return { success: false, reason: 'missing_token' };
    }
    return this.relationshipsService.acceptByToken(body.token);
  }
}
