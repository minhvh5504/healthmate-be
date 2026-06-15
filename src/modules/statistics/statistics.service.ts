import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { subDays, subMonths, startOfDay, endOfDay, format } from 'date-fns';
import { Role } from '@prisma/client';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get general dashboard statistics
   */
  async getDashboardStats() {
    const totalUsers = await this.prisma.user.count({
      where: { role: Role.user },
    });

    const activeUsers = await this.prisma.user.count({
      where: { isActive: true, role: Role.user },
    });

    const usersYesterday = await this.prisma.user.count({
      where: {
        role: Role.user,
        createdAt: {
          lt: startOfDay(new Date()),
        },
      },
    });

    const userChange =
      usersYesterday > 0 ? ((totalUsers - usersYesterday) / usersYesterday) * 100 : 0;

    return ResponseHelper.success(
      {
        users: {
          total: totalUsers,
          active: activeUsers,
          change: parseFloat(userChange.toFixed(2)),
        },
      },
      MessageCodes.STATISTICS_RETRIEVED,
      'Lấy thống kê tổng quan thành công',
    );
  }

  /**
   * Get chart data for user growth
   */
  async getChartData(type: 'week' | 'month' | 'year' = 'year') {
    const now = new Date();
    const intervals: { label: string; start: Date; end: Date }[] = [];

    if (type === 'week') {
      for (let i = 0; i < 7; i++) {
        const date = subDays(now, 6 - i);
        intervals.push({
          label: format(date, 'EEE'),
          start: startOfDay(date),
          end: endOfDay(date),
        });
      }
    } else if (type === 'month') {
      for (let i = 0; i < 30; i += 3) {
        const date = subDays(now, 27 - i);
        intervals.push({
          label: format(date, 'dd/MM'),
          start: startOfDay(subDays(date, 2)),
          end: endOfDay(date),
        });
      }
    } else {
      // Year
      for (let i = 0; i < 12; i++) {
        const date = subMonths(now, 11 - i);
        intervals.push({
          label: format(date, 'MMM'),
          start: new Date(date.getFullYear(), date.getMonth(), 1),
          end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
        });
      }
    }

    const chartData = await Promise.all(
      intervals.map(async (interval) => {
        const count = await this.prisma.user.count({
          where: {
            role: Role.user,
            createdAt: {
              gte: interval.start,
              lte: interval.end,
            },
          },
        });

        return {
          label: interval.label,
          users: count,
        };
      }),
    );

    return ResponseHelper.success(
      chartData,
      MessageCodes.STATISTICS_RETRIEVED,
      'Lấy dữ liệu biểu đồ thành công',
    );
  }

  /**
   * Get 10 most recent users
   */
  async getRecentUsers() {
    const users = await this.prisma.user.findMany({
      where: { role: Role.user },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        profile: true,
      },
    });

    const result = users.map((user) => ({
      id: user.id,
      fullName: user.profile?.fullName || 'N/A',
      email: user.email,
      avatar: user.avatarUrl,
      createdAt: user.createdAt,
      isActive: user.isActive,
    }));

    return ResponseHelper.success(
      result,
      MessageCodes.STATISTICS_RETRIEVED,
      'Lấy danh sách người dùng gần đây thành công',
    );
  }
}
