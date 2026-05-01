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
import { MailsService } from '../mails/mails.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserRelationshipsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private mailsService: MailsService,
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
        ResponseHelper.error(MessageCodes.USER_NOT_FOUND, 'User to invite not found', 404),
      );
    }

    // Get current user info for the email
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!currentUser) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.USER_NOT_FOUND, 'Current user not found', 404),
      );
    }

    if (relatedUser.id === userId) {
      throw new BadRequestException(
        ResponseHelper.error('RELATIONSHIP.SELF_INVITE', 'You cannot invite yourself', 400),
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
          'Invitation sent',
        );
      }

      throw new ConflictException(
        ResponseHelper.error(
          MessageCodes.RELATIONSHIP_ALREADY_EXISTS,
          'A relationship already exists between these users',
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
      title: 'New Connection Request',
      body: `${currentUser.profile?.fullName || currentUser.email} wants to connect with you.`,
      iconType: 'user_plus',
    });

    // 5. Generate a secure token for one-click acceptance (valid for 24h)
    const invitationToken = this.jwtService.sign(
      { relationshipId: relationship.id, type: 'connection_invite' },
      { expiresIn: '24h' },
    );

    // 6. Send invitation email with Deep Link + Token
    void this.mailsService.sendConnectionInvitation({
      toEmail: relatedUser.email,
      inviterName: currentUser.profile?.fullName || 'Healthmate User',
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
      'Invitation sent successfully',
    );
  }

  async accept(relationshipId: string, currentUserId: string) {
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Relationship not found', 404),
      );
    }

    if (relationship.relatedUserId !== currentUserId) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'You can only accept invitations sent to you',
          403,
        ),
      );
    }

    if (relationship.status !== 'pending') {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.RELATIONSHIP_NOT_PENDING,
          'Relationship is not pending',
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
      title: 'Connection Request Accepted',
      body: `Your connection request has been accepted.`,
      iconType: 'user_check',
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.RELATIONSHIP_ACCEPTED,
      'Invitation accepted successfully',
    );
  }

  async revoke(relationshipId: string, currentUserId: string) {
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Relationship not found', 404),
      );
    }

    if (relationship.userId !== currentUserId && relationship.relatedUserId !== currentUserId) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'You are not part of this relationship',
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
      'Relationship revoked successfully',
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
      'Relationships retrieved successfully',
    );
  }

  async remove(relationshipId: string, currentUserId: string) {
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Relationship not found', 404),
      );
    }

    if (relationship.userId !== currentUserId && relationship.relatedUserId !== currentUserId) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.INSUFFICIENT_PERMISSIONS,
          'You are not part of this relationship',
          403,
        ),
      );
    }

    await this.prisma.userRelationship.delete({
      where: { id: relationshipId },
    });

    return ResponseHelper.success(null, MessageCodes.RELATIONSHIP_DELETED, 'Relationship deleted');
  }

  async acceptByToken(token: string) {
    try {
      const payload = this.jwtService.verify<{
        type: string;
        relationshipId: string;
      }>(token);

      if (payload.type !== 'connection_invite' || !payload.relationshipId) {
        throw new BadRequestException(
          ResponseHelper.error('RELATIONSHIP.INVALID_TOKEN', 'Invalid invitation token', 400),
        );
      }

      const relationship = await this.prisma.userRelationship.findUnique({
        where: { id: payload.relationshipId },
      });

      if (!relationship) {
        throw new NotFoundException(
          ResponseHelper.error(MessageCodes.RELATIONSHIP_NOT_FOUND, 'Invitation not found', 404),
        );
      }

      if (relationship.status !== 'pending') {
        return ResponseHelper.success(
          relationship,
          MessageCodes.RELATIONSHIP_ALREADY_EXISTS,
          'This invitation has already been processed',
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
        title: 'Connection Request Accepted',
        body: `Your connection request has been accepted via email.`,
        iconType: 'user_check',
      });

      return ResponseHelper.success(
        updated,
        MessageCodes.RELATIONSHIP_ACCEPTED,
        'Invitation accepted successfully',
      );
    } catch (e) {
      const error = e as { name?: string };
      if (error?.name === 'TokenExpiredError') {
        throw new BadRequestException(
          ResponseHelper.error('RELATIONSHIP.TOKEN_EXPIRED', 'Invitation link has expired', 400),
        );
      }
      throw e;
    }
  }
}
