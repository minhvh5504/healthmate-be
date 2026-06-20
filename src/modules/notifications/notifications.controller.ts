import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { DeleteNotificationDto } from './dto/delete-notification.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register for FCM device token' })
  registerDeviceToken(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceTokenDto) {
    return this.notificationsService.registerDeviceToken(userId, dto);
  }

  @Delete('device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister FCM device token on logout' })
  unregisterDeviceToken(@CurrentUser('id') userId: string, @Query('token') token: string) {
    return this.notificationsService.unregisterDeviceToken(userId, token);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notifications for current user' })
  findAll(@CurrentUser('id') userId: string, @Query() query: QueryNotificationDto) {
    return this.notificationsService.findAll(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notification (Admin/System only ideally)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(userId, dto);
  }

  @Patch('mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark multiple or all notifications as read' })
  markReadBulk(@CurrentUser('id') userId: string, @Body() dto: MarkReadDto) {
    return this.notificationsService.markReadBulk(userId, dto.ids, dto.all);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete multiple or all notifications' })
  removeBulk(@CurrentUser('id') userId: string, @Body() dto: DeleteNotificationDto) {
    return this.notificationsService.removeBulk(userId, dto.ids, dto.all);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single notification' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.remove(userId, id);
  }

  // Deprecated endpoints mapping to new bulk logic
  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read (Deprecated - use PATCH /mark-read)' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markReadBulk(userId, [], true);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all notifications (Deprecated - use DELETE /bulk)' })
  removeAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.removeBulk(userId, [], true);
  }
}
