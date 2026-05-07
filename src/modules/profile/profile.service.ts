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

    // Fetch logs for health delta
    const logs = await this.prisma.userHealthLog.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 2,
    });

    let healthDelta: {
      weightKg: number;
      heightCm: number;
      daysSinceLastUpdate: number;
    } | null = null;
    if (logs.length === 2) {
      const current = logs[0];
      const previous = logs[1];

      const diffTime = Math.abs(current.recordedAt.getTime() - previous.recordedAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      healthDelta = {
        weightKg: Number(current.weightKg) - Number(previous.weightKg),
        heightCm: Number(current.heightCm) - Number(previous.heightCm),
        daysSinceLastUpdate: diffDays,
      };
    }

    const result = {
      ...userWithoutSensitiveData,
      profile: profile
        ? {
            ...profile,
            healthDelta,
          }
        : null,
    };

    return ResponseHelper.success(
      result,
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

    const weightKg =
      updateProfileDto.weightKg !== undefined
        ? updateProfileDto.weightKg
        : user.profile?.weightKg
          ? Number(user.profile.weightKg)
          : null;

    const heightCm =
      updateProfileDto.heightCm !== undefined
        ? updateProfileDto.heightCm
        : user.profile?.heightCm
          ? Number(user.profile.heightCm)
          : null;

    const { bmi, bmiStatus } = this.calculateBMI(weightKg, heightCm);

    const updatedProfile = await this.prisma.$transaction(async (tx) => {
      const up = await tx.userProfile.upsert({
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

      // Insert into UserHealthLog if height or weight is provided
      if (updateProfileDto.heightCm !== undefined || updateProfileDto.weightKg !== undefined) {
        await tx.userHealthLog.create({
          data: {
            userId,
            heightCm: heightCm !== null ? heightCm : undefined,
            weightKg: weightKg !== null ? weightKg : undefined,
            bmi,
            bmiStatus,
          },
        });
      }

      return up;
    });

    return ResponseHelper.success(
      updatedProfile,
      MessageCodes.USER_UPDATED,
      'Profile updated successfully',
      200,
    );
  }

  /**
   * Get health analysis (BMI comparison with peers)
   */
  async getHealthAnalysis(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User profile not found',
        404,
        'Health analysis failed',
      );
    }

    const profile = user.profile;
    const bmi = profile.bmi ? Number(profile.bmi) : null;

    if (!bmi || !profile.dateOfBirth || !profile.gender) {
      return ResponseHelper.success(
        {
          userBMI: bmi,
          peerBMI: null,
          percentage: null,
          status: 'INCOMPLETE_DATA',
        },
        MessageCodes.PROFILE_RETRIEVED,
        'Incomplete profile data for analysis',
        200,
      );
    }

    // Calculate age
    const today = new Date();
    const birthDate = profile.dateOfBirth;
    if (!birthDate) {
      return ResponseHelper.success(
        {
          userBMI: bmi,
          peerBMI: null,
          percentage: null,
          status: 'INCOMPLETE_DATA',
        },
        MessageCodes.PROFILE_RETRIEVED,
        'Incomplete profile data for analysis',
        200,
      );
    }
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Find benchmark
    const benchmark = await this.prisma.healthBenchmark.findFirst({
      where: {
        type: 'BMI',
        gender: profile.gender,
        ageMin: { lte: age },
        ageMax: { gte: age },
      },
    });

    if (!benchmark) {
      return ResponseHelper.success(
        {
          userBMI: bmi,
          peerBMI: null,
          percentage: null,
          status: 'NO_BENCHMARK_FOUND',
        },
        MessageCodes.PROFILE_RETRIEVED,
        'No benchmark found for your age/gender',
        200,
      );
    }

    const peerBMI = Number(benchmark.value);
    const diff = bmi - peerBMI;
    const percentage = Math.abs((diff / peerBMI) * 100);

    let status = 'NORMAL';
    if (diff > 0.5) status = 'HIGHER';
    if (diff < -0.5) status = 'LOWER';

    const result = {
      userBMI: parseFloat(bmi.toFixed(1)),
      peerBMI: parseFloat(peerBMI.toFixed(1)),
      percentage: parseFloat(percentage.toFixed(0)),
      status,
      peerDescription: benchmark.description,
    };

    return ResponseHelper.success(
      result,
      MessageCodes.PROFILE_RETRIEVED,
      'Health analysis retrieved successfully',
      200,
    );
  }

  /**
   * [ADMIN] Get all users with pagination and filtering
   */
  async findAllAdmin(page = 1, limit = 10, status?: 'active' | 'inactive' | 'all') {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const result = users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, failedLoginAttempts, lockedUntil, ...userData } = user;
      return userData;
    });

    return ResponseHelper.success(
      {
        users: result,
        total,
        page,
        limit,
      },
      MessageCodes.USER_LIST_RETRIEVED,
      'User list retrieved successfully',
      200,
    );
  }

  /**
   * [ADMIN] Get specific user details
   */
  async findOneAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userMedications: {
          include: { medication: true },
        },
      },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'User retrieval failed',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, failedLoginAttempts, lockedUntil, ...userData } = user;

    return ResponseHelper.success(
      userData,
      MessageCodes.USER_RETRIEVED,
      'User details retrieved successfully',
      200,
    );
  }

  /**
   * [ADMIN] Toggle user active status
   */
  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Status toggle failed',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    return ResponseHelper.success(
      { isActive: updatedUser.isActive },
      MessageCodes.USER_UPDATED,
      `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
      200,
    );
  }

  /**
   * [ADMIN] Delete user account
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'User deletion failed',
      );
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.USER_DELETED,
      'User deleted successfully',
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
      bmiStatus = 'UNDERWEIGHT';
    } else if (bmi < 25) {
      bmiStatus = 'NORMAL';
    } else if (bmi < 30) {
      bmiStatus = 'OVERWEIGHT';
    } else {
      bmiStatus = 'OBESE';
    }

    return { bmi, bmiStatus };
  }
}
