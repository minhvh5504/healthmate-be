import { Injectable } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        googleId: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            fullName: true,
            dateOfBirth: true,
            gender: true,
            heightCm: true,
            weightKg: true,
            allergies: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Profile retrieval failed',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked. Please contact admin to unlock your account.',
        401,
        'Profile retrieval failed',
      );
    }

    return ResponseHelper.success(
      user,
      MessageCodes.PROFILE_RETRIEVED,
      'Profile retrieved successfully',
      200,
    );
  }
  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    let dateOfBirth: Date | undefined;
    if (updateProfileDto.dateOfBirth) {
      dateOfBirth = new Date(updateProfileDto.dateOfBirth);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Profile update failed',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Your account has been deactivated/blocked. Please contact admin to unlock your account.',
        401,
        'Profile update failed',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dateOfBirth: _dob, ...restData } = updateProfileDto;

    const updatedProfile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...restData,
        ...(dateOfBirth && { dateOfBirth }),
      },
      update: {
        ...restData,
        ...(dateOfBirth && { dateOfBirth }),
      },
    });

    return ResponseHelper.success(
      updatedProfile,
      MessageCodes.USER_UPDATED,
      'Profile updated successfully',
      200,
    );
  }
}
