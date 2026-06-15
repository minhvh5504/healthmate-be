import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { InviteUserDto } from './dto/invite-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mails/mails.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserRelationshipsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async invite(userId: string, inviteDto: InviteUserDto) {
    const { email } = inviteDto;

    // 1. Find user to invite
    const relatedUser = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!relatedUser) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.USER_NOT_FOUND, 'Không tìm thấy người dùng cần mời', 404),
      );
    }

    // Get current user info for the email
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!currentUser) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.USER_NOT_FOUND, 'Không tìm thấy người dùng hiện tại', 404),
      );
    }

    if (relatedUser.id === userId) {
      throw new BadRequestException(
        ResponseHelper.error('RELATIONSHIP.SELF_INVITE', 'Bạn không thể tự gửi lời mời cho chính mình', 400),
      );
    }

    // 2. Check if relationship already exists
    const existing = await this.prisma.userRelationship.findFirst({
      where: {
        OR: [
          { userId, relatedUserId: relatedUser.id },
          { userId: relatedUser.id, relatedUserId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'revoked') {
        // Re-open revoked relationship
        const updated = await this.prisma.userRelationship.update({
          where: { id: existing.id },
          data: {
            userId, // Current user becomes the inviter again
            relatedUserId: relatedUser.id,
            status: 'pending',
            invitedAt: new Date(),
            acceptedAt: null,
            revokedAt: null,
          },
        });
        return ResponseHelper.success(
          updated,
          MessageCodes.RELATIONSHIP_INVITED,
          'Đã gửi lời mời',
        );
      }

      throw new ConflictException(
        ResponseHelper.error(
          MessageCodes.RELATIONSHIP_ALREADY_EXISTS,
          'Mối liên kết giữa hai người dùng này đã tồn tại',
          409,
        ),
      );
    }

    // 3. Create new relationship
    const relationship = await this.prisma.userRelationship.create({
      data: {
        userId,
        relatedUserId: relatedUser.id,
        status: 'pending',
      },
    });

    // 4. Create notification for the invited user
    await this.notificationsService.createNotification({
      userId: relatedUser.id,
      type: 'RELATIONSHIP_INVITE',
      title: 'Lời mời kết nối mới',
      body: `${currentUser.profile?.fullName || currentUser.email} muốn kết nối với bạn.`,
      iconType: 'user_plus',
    });

    // 5. Generate a secure token for one-click acceptance (valid for 24h)
    const invitationToken = this.jwtService.sign(
      { relationshipId: relationship.id, type: 'connection_invite' },
      { expiresIn: '24h' },
    );

    // 6. Send invitation email with Deep Link + Token
    void this.mailService.sendConnectionInvitation({
      toEmail: relatedUser.email,
      inviterName: currentUser.profile?.fullName || 'Người dùng Healthmate',
      inviterEmail: currentUser.email,
      relationshipId: relationship.id,
      token: invitationToken,
    });

    return ResponseHelper.success(
      {
        relationship,
        invitationLink: `${this.configService.get('DEEP_LINK_URL')}?token=${invitationToken}`,
      },
      MessageCodes.RELATIONSHIP_INVITED,
      'Đã gửi lời mời thành công',
    );
  }

  async accept(relationshipId: string, currentUserId: string) {
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Không tìm thấy mối liên kết', 404),
      );
    }

    if (relationship.relatedUserId !== currentUserId) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Bạn chỉ có thể chấp nhận lời mời được gửi cho bạn',
          403,
        ),
      );
    }

    if (relationship.status !== 'pending') {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.RELATIONSHIP_NOT_PENDING,
          'Lời mời kết nối không còn ở trạng thái chờ',
          400,
        ),
      );
    }

    const updated = await this.prisma.userRelationship.update({
      where: { id: relationshipId },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    // Notify the inviter
    await this.notificationsService.createNotification({
      userId: relationship.userId,
      type: 'RELATIONSHIP_ACCEPTED',
      title: 'Lời mời kết nối đã được chấp nhận',
      body: `Lời mời kết nối của bạn đã được chấp nhận.`,
      iconType: 'user_check',
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.RELATIONSHIP_ACCEPTED,
      'Đã chấp nhận lời mời thành công',
    );
  }

  async revoke(relationshipId: string, currentUserId: string) {
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Không tìm thấy mối liên kết', 404),
      );
    }

    if (relationship.userId !== currentUserId && relationship.relatedUserId !== currentUserId) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Bạn không thuộc mối liên kết này',
          403,
        ),
      );
    }

    const updated = await this.prisma.userRelationship.update({
      where: { id: relationshipId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.RELATIONSHIP_REVOKED,
      'Đã hủy mối liên kết thành công',
    );
  }

  async findAll(userId: string) {
    const relationships = await this.prisma.userRelationship.findMany({
      where: {
        OR: [{ userId }, { relatedUserId: userId }],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
        relatedUser: {
          select: {
            id: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    // Format the list to show "Other User" info clearly
    const formatted = relationships.map((rel) => {
      const isInviter = rel.userId === userId;
      const otherUser = isInviter ? rel.relatedUser : rel.user;
      return {
        id: rel.id,
        status: rel.status,
        invitedAt: rel.invitedAt,
        acceptedAt: rel.acceptedAt,
        revokedAt: rel.revokedAt,
        isInviter,
        otherUser: {
          id: otherUser.id,
          email: otherUser.email,
          fullName: otherUser.profile?.fullName || null,
          avatarUrl: otherUser.avatarUrl,
        },
      };
    });

    return ResponseHelper.success(
      formatted,
      MessageCodes.RELATIONSHIP_LIST_RETRIEVED,
      'Đã lấy danh sách mối liên kết thành công',
    );
  }

  async remove(relationshipId: string, currentUserId: string) {
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Không tìm thấy mối liên kết', 404),
      );
    }

    if (relationship.userId !== currentUserId && relationship.relatedUserId !== currentUserId) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'Bạn không thuộc mối liên kết này',
          403,
        ),
      );
    }

    await this.prisma.userRelationship.delete({
      where: { id: relationshipId },
    });

    return ResponseHelper.success(null, MessageCodes.RELATIONSHIP_DELETED, 'Đã xóa mối liên kết');
  }

  async acceptByToken(token: string) {
    try {
      const payload = this.jwtService.verify<{
        type: string;
        relationshipId: string;
      }>(token);

      if (payload.type !== 'connection_invite' || !payload.relationshipId) {
        throw new BadRequestException(
          ResponseHelper.error('RELATIONSHIP.INVALID_TOKEN', 'Token lời mời không hợp lệ', 400),
        );
      }

      const relationship = await this.prisma.userRelationship.findUnique({
        where: { id: payload.relationshipId },
      });

      if (!relationship) {
        throw new NotFoundException(
          ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Không tìm thấy lời mời', 404),
        );
      }

      if (relationship.status !== 'pending') {
        return ResponseHelper.success(
          relationship,
          MessageCodes.RELATIONSHIP_ALREADY_EXISTS,
          'Lời mời này đã được xử lý trước đó',
        );
      }

      const updated = await this.prisma.userRelationship.update({
        where: { id: relationship.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });

      // Notify the inviter
      await this.notificationsService.createNotification({
        userId: relationship.userId,
        type: 'RELATIONSHIP_ACCEPTED',
        title: 'Lời mời kết nối đã được chấp nhận',
        body: `Lời mời kết nối của bạn đã được chấp nhận qua email.`,
        iconType: 'user_check',
      });

      return ResponseHelper.success(
        updated,
        MessageCodes.RELATIONSHIP_ACCEPTED,
        'Đã chấp nhận lời mời thành công',
      );
    } catch (e) {
      const error = e as { name?: string };
      if (error?.name === 'TokenExpiredError') {
        throw new BadRequestException(
          ResponseHelper.error('RELATIONSHIP.TOKEN_EXPIRED', 'Đường dẫn lời mời đã hết hạn', 400),
        );
      }
      throw e;
    }
  }
}
