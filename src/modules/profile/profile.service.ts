/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  HealthHistoryChangesQueryDto,
  HealthHistoryMetric,
  HealthHistoryPeriod,
  HealthHistoryQueryDto,
} from './dto/health-history-query.dto';
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
        'Không tìm thấy người dùng',
        404,
        'Lấy hồ sơ thất bại',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Lấy hồ sơ thất bại',
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

    let healthDelta: {
      weightKg: number;
      heightCm: number;
      daysSinceLastUpdate: number;
    } | null = null;

    if (profile) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const healthAverages = await this.prisma.userHealthLog.aggregate({
        where: {
          userId,
          recordedAt: { gte: thirtyDaysAgo },
        },
        _avg: {
          weightKg: true,
          heightCm: true,
        },
      });

      const currentWeightKg =
        profile.weightKg !== null && profile.weightKg !== undefined
          ? Number(profile.weightKg)
          : null;
      const currentHeightCm =
        profile.heightCm !== null && profile.heightCm !== undefined
          ? Number(profile.heightCm)
          : null;
      const averageWeightKg =
        healthAverages._avg.weightKg !== null && healthAverages._avg.weightKg !== undefined
          ? Number(healthAverages._avg.weightKg)
          : null;
      const averageHeightCm =
        healthAverages._avg.heightCm !== null && healthAverages._avg.heightCm !== undefined
          ? Number(healthAverages._avg.heightCm)
          : null;

      if (averageWeightKg !== null || averageHeightCm !== null) {
        healthDelta = {
          weightKg:
            currentWeightKg !== null && averageWeightKg !== null
              ? currentWeightKg - averageWeightKg
              : 0,
          heightCm:
            currentHeightCm !== null && averageHeightCm !== null
              ? currentHeightCm - averageHeightCm
              : 0,
          daysSinceLastUpdate: 30,
        };
      }
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
      'Lấy hồ sơ thành công',
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
        'Không tìm thấy người dùng',
        404,
        'Cập nhật hồ sơ thất bại',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        'Cập nhật hồ sơ thất bại',
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

      // Log only the metric fields that were explicitly updated.
      const shouldLogHeight = updateProfileDto.heightCm !== undefined;
      const shouldLogWeight = updateProfileDto.weightKg !== undefined;

      if (shouldLogHeight || shouldLogWeight) {
        await tx.userHealthLog.create({
          data: {
            userId,
            heightCm: shouldLogHeight && heightCm !== null ? heightCm : undefined,
            weightKg: shouldLogWeight && weightKg !== null ? weightKg : undefined,
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
      'Cập nhật hồ sơ thành công',
      200,
    );
  }

  /**
   * Get health history chart data by period.
   */
  async getHealthHistory(userId: string, query: HealthHistoryQueryDto) {
    const metric = query.metric ?? HealthHistoryMetric.weight;
    const period = query.period ?? HealthHistoryPeriod.day;
    const referenceDate = query.date ? new Date(query.date) : new Date();
    const { startDate, endDate } = this.getPeriodRange(period, referenceDate);

    const profile = await this.getActiveUserProfile(userId, 'Lấy lịch sử sức khỏe thất bại');
    const field = this.getMetricField(metric);
    const unit = this.getMetricUnit(metric);
    const currentValue =
      profile[field] !== null && profile[field] !== undefined ? Number(profile[field]) : null;

    const logs = await this.prisma.userHealthLog.findMany({
      where: {
        userId,
        recordedAt: { gte: startDate, lt: endDate },
        [field]: { not: null },
      },
      orderBy: { recordedAt: 'asc' },
      select: {
        id: true,
        recordedAt: true,
        weightKg: true,
        heightCm: true,
      },
    });

    const buckets = new Map<
      string,
      { value: number; recordedAt: Date; label: string; index: number; count: number }
    >();

    for (const log of logs) {
      const value = log[field] !== null && log[field] !== undefined ? Number(log[field]) : null;
      if (value === null) continue;

      const bucket = this.getHistoryBucket(period, log.recordedAt);
      const existing = buckets.get(bucket.key);

      if (existing) {
        existing.count += 1;
        if (log.recordedAt >= existing.recordedAt) {
          existing.value = value;
          existing.recordedAt = log.recordedAt;
          existing.label = bucket.label;
          existing.index = bucket.index;
        }
      } else {
        buckets.set(bucket.key, {
          value,
          recordedAt: log.recordedAt,
          label: bucket.label,
          index: bucket.index,
          count: 1,
        });
      }
    }

    const points = Array.from(buckets.values())
      .map((bucket) => ({
        index: bucket.index,
        label: bucket.label,
        value: this.roundMetric(bucket.value),
        recordedAt: bucket.recordedAt,
        count: bucket.count,
      }))
      .sort((a, b) => a.index - b.index);

    const averageValue =
      points.length > 0
        ? this.roundMetric(points.reduce((sum, point) => sum + point.value, 0) / points.length)
        : null;

    return ResponseHelper.success(
      {
        metric,
        period,
        unit,
        currentValue: currentValue !== null ? this.roundMetric(currentValue) : null,
        averageValue,
        startDate,
        endDate,
        points,
      },
      MessageCodes.PROFILE_RETRIEVED,
      'Lấy lịch sử sức khỏe thành công',
      200,
    );
  }

  /**
   * Get raw metric changes with delta against the previous recorded value.
   */
  async getHealthHistoryChanges(userId: string, query: HealthHistoryChangesQueryDto) {
    const metric = query.metric ?? HealthHistoryMetric.weight;
    const period = query.period ?? HealthHistoryPeriod.day;
    const referenceDate = query.date ? new Date(query.date) : new Date();
    const { startDate, endDate } = this.getPeriodRange(period, referenceDate);
    const field = this.getMetricField(metric);
    const unit = this.getMetricUnit(metric);

    await this.getActiveUserProfile(userId, 'Lấy lịch sử thay đổi sức khỏe thất bại');

    const logs = await this.prisma.userHealthLog.findMany({
      where: {
        userId,
        recordedAt: { gte: startDate, lt: endDate },
        [field]: { not: null },
      },
      orderBy: { recordedAt: 'asc' },
      select: {
        id: true,
        recordedAt: true,
        weightKg: true,
        heightCm: true,
        bmi: true,
        bmiStatus: true,
      },
    });

    let previousValue: number | null = null;
    const changes = logs.map((log) => {
      const value = Number(log[field]);
      const change = previousValue !== null ? this.roundMetric(value - previousValue) : null;
      const item = {
        id: log.id,
        metric,
        unit,
        value: this.roundMetric(value),
        previousValue: previousValue !== null ? this.roundMetric(previousValue) : null,
        change,
        direction: change === null ? 'initial' : change > 0 ? 'up' : change < 0 ? 'down' : 'same',
        bmi: log.bmi !== null && log.bmi !== undefined ? Number(log.bmi) : null,
        bmiStatus: log.bmiStatus,
        recordedAt: log.recordedAt,
      };
      previousValue = value;
      return item;
    });

    return ResponseHelper.success(
      {
        metric,
        unit,
        changes: changes.reverse(),
      },
      MessageCodes.PROFILE_RETRIEVED,
      'Lấy lịch sử thay đổi sức khỏe thành công',
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
        'Không tìm thấy hồ sơ người dùng',
        404,
        'Phân tích sức khỏe thất bại',
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
        'Chưa đủ dữ liệu hồ sơ để phân tích',
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
        'Chưa đủ dữ liệu hồ sơ để phân tích',
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
        'Chưa có dữ liệu tham chiếu phù hợp với tuổi/giới tính của bạn',
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
      'Lấy phân tích sức khỏe thành công',
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
      'Lấy danh sách người dùng thành công',
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
        'Không tìm thấy người dùng',
        404,
        'Lấy thông tin người dùng thất bại',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, failedLoginAttempts, lockedUntil, ...userData } = user;

    return ResponseHelper.success(
      userData,
      MessageCodes.USER_RETRIEVED,
      'Lấy chi tiết người dùng thành công',
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
        'Không tìm thấy người dùng',
        404,
        'Cập nhật trạng thái thất bại',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    return ResponseHelper.success(
      { isActive: updatedUser.isActive },
      MessageCodes.USER_UPDATED,
      `Đã ${updatedUser.isActive ? 'kích hoạt' : 'vô hiệu hóa'} người dùng thành công`,
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
        'Không tìm thấy người dùng',
        404,
        'Xóa người dùng thất bại',
      );
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.USER_DELETED,
      'Xóa người dùng thành công',
      200,
    );
  }

  private async getActiveUserProfile(userId: string, failureTitle: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Không tìm thấy hồ sơ người dùng',
        404,
        failureTitle,
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_DISABLED,
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc khóa. Vui lòng liên hệ quản trị viên để mở khóa.',
        401,
        failureTitle,
      );
    }

    return user.profile;
  }

  private getMetricField(metric: HealthHistoryMetric) {
    return metric === HealthHistoryMetric.height ? 'heightCm' : 'weightKg';
  }

  private getMetricUnit(metric: HealthHistoryMetric) {
    return metric === HealthHistoryMetric.height ? 'cm' : 'kg';
  }

  private getPeriodRange(period: HealthHistoryPeriod, referenceDate: Date) {
    const date = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;
    const parts = this.getVietnamDateParts(date);

    switch (period) {
      case HealthHistoryPeriod.day: {
        const startDate = this.vietnamDateToUtc(parts.year, parts.month, parts.day);
        const endDate = this.vietnamDateToUtc(parts.year, parts.month, parts.day + 1);
        return { startDate, endDate };
      }
      case HealthHistoryPeriod.week: {
        const mondayOffset = (parts.weekday + 6) % 7;
        const startDate = this.vietnamDateToUtc(parts.year, parts.month, parts.day - mondayOffset);
        const endDate = this.vietnamDateToUtc(
          parts.year,
          parts.month,
          parts.day - mondayOffset + 7,
        );
        return { startDate, endDate };
      }
      case HealthHistoryPeriod.month: {
        const startDate = this.vietnamDateToUtc(parts.year, parts.month, 1);
        const endDate = this.vietnamDateToUtc(parts.year, parts.month + 1, 1);
        return { startDate, endDate };
      }
    }
  }

  private getHistoryBucket(period: HealthHistoryPeriod, recordedAt: Date) {
    const parts = this.getVietnamDateParts(recordedAt);

    switch (period) {
      case HealthHistoryPeriod.day: {
        const bucketHour = Math.floor(parts.hour / 4) * 4;
        return {
          key: `${this.formatDateKey(parts.year, parts.month, parts.day)}-${String(bucketHour).padStart(2, '0')}`,
          label: String(bucketHour),
          index: bucketHour,
        };
      }
      case HealthHistoryPeriod.week: {
        const index = (parts.weekday + 6) % 7;
        const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        return {
          key: this.formatDateKey(parts.year, parts.month, parts.day),
          label: labels[index],
          index,
        };
      }
      case HealthHistoryPeriod.month: {
        const mondayOffset = (parts.weekday + 6) % 7;
        const weekStart = new Date(Date.UTC(parts.year, parts.month, parts.day - mondayOffset));
        return {
          key: this.formatDateKey(
            weekStart.getUTCFullYear(),
            weekStart.getUTCMonth(),
            weekStart.getUTCDate(),
          ),
          label: String(parts.day),
          index: parts.day - 1,
        };
      }
    }
  }

  private vietnamDateToUtc(year: number, month: number, day: number) {
    return new Date(Date.UTC(year, month, day) - this.vietnamTimezoneOffsetMs());
  }

  private getVietnamDateParts(date: Date) {
    const vietnamDate = new Date(date.getTime() + this.vietnamTimezoneOffsetMs());
    return {
      year: vietnamDate.getUTCFullYear(),
      month: vietnamDate.getUTCMonth(),
      day: vietnamDate.getUTCDate(),
      hour: vietnamDate.getUTCHours(),
      weekday: vietnamDate.getUTCDay(),
    };
  }

  private vietnamTimezoneOffsetMs() {
    return 7 * 60 * 60 * 1000;
  }

  private formatDateKey(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private roundMetric(value: number) {
    return Number(value.toFixed(1));
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
