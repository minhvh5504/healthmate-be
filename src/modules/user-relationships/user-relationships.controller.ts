import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserRelationshipsService } from './user-relationships.service';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InviteUserDto } from './dto/invite-user.dto';

@ApiTags('User Relationships')
@Controller('user-relationships')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserRelationshipsController {
  constructor(private readonly relationshipsService: UserRelationshipsService) {}

  @Post('invite')
  @ApiOperation({ summary: 'Send an invitation to another user' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  invite(@Request() req, @Body() inviteDto: InviteUserDto) {
    return this.relationshipsService.invite(req.user.id, inviteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all relationships (invitations sent and received)' })
  findAll(@Request() req) {
    return this.relationshipsService.findAll(req.user.id);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept a pending invitation' })
  accept(@Param('id') id: string, @Request() req) {
    return this.relationshipsService.accept(id, req.user.id);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke an existing relationship' })
  revoke(@Param('id') id: string, @Request() req) {
    return this.relationshipsService.revoke(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a relationship' })
  remove(@Param('id') id: string, @Request() req) {
    return this.relationshipsService.remove(id, req.user.id);
  }
}
