/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
      include: {
        profile: true,
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, failedLoginAttempts, lockedUntil, ...userWithoutSensitiveData } = user;

    // Use a typed variable for profile but cast to any temporarily to bypass IDE cache issues
    const profile = userWithoutSensitiveData.profile as any;

    if (profile && (profile.bmi === null || profile.bmiStatus === null)) {
      const { bmi, bmiStatus } = this.calculateBMI(
        profile.weightKg ? Number(profile.weightKg) : null,
        profile.heightCm ? Number(profile.heightCm) : null,
      );
      profile.bmi = bmi;
      profile.bmiStatus = bmiStatus;
    }

    return ResponseHelper.success(
      userWithoutSensitiveData,
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
      include: { profile: true },
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

    // Calculate BMI using new values or existing ones
    const weightKg =
      updateProfileDto.weightKg !== undefined
        ? updateProfileDto.weightKg
        : (user.profile as any)?.weightKg
          ? Number((user.profile as any).weightKg)
          : null;

    const heightCm =
      updateProfileDto.heightCm !== undefined
        ? updateProfileDto.heightCm
        : (user.profile as any)?.heightCm
          ? Number((user.profile as any).heightCm)
          : null;

    const { bmi, bmiStatus } = this.calculateBMI(weightKg, heightCm);

    const updatedProfile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...restData,
        bmi,
        bmiStatus,
        ...(dateOfBirth && { dateOfBirth }),
      } as any,
      update: {
        ...restData,
        bmi,
        bmiStatus,
        ...(dateOfBirth && { dateOfBirth }),
      } as any,
    });

    return ResponseHelper.success(
      updatedProfile,
      MessageCodes.USER_UPDATED,
      'Profile updated successfully',
      200,
    );
  }

  /**
   * Helper to calculate BMI and status
   */
  private calculateBMI(weightKg: number | null, heightCm: number | null) {
    if (!weightKg || !heightCm || heightCm <= 0) {
      return { bmi: null, bmiStatus: null };
    }

    const heightM = heightCm / 100;
    const bmiValue = weightKg / (heightM * heightM);
    const bmi = parseFloat(bmiValue.toFixed(2));

    let bmiStatus = '';
    if (bmi < 18.5) {
      bmiStatus = 'Thiếu cân';
    } else if (bmi < 25) {
      bmiStatus = 'Cân đối';
    } else if (bmi < 30) {
      bmiStatus = 'Thừa cân';
    } else {
      bmiStatus = 'Béo phì';
    }

    return { bmi, bmiStatus };
  }
}
