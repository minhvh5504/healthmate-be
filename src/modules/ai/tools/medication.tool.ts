import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getMealInstructionFromTime } from '../../../common/utils/medication-helper';

type ToolArgs = Record<string, unknown>;

interface ScheduleForStockEstimate {
  repeatType: string;
  repeatDays: number[];
  quantity: number | null;
}

@Injectable()
export class MedicationTool {
  constructor(private readonly prisma: PrismaService) {}

  getToolDefinition() {
    return this.getToolDefinitions()[0];
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_user_medications',
          description:
            'Get active medications the user is tracking, including dosage, stock remaining, low stock threshold, refill estimate, and reminder schedules.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_today_medication_schedule',
          description:
            'Get the medication schedule for a specific day. Use this when the user asks what medicines to take today, tomorrow, or at what time.',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description:
                  'Date in YYYY-MM-DD format. Leave empty to use today in Asia/Ho_Chi_Minh.',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_bmi_analysis',
          description:
            'Get the current user BMI, BMI status, and comparison with benchmark data for the user age and gender.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
    ];
  }

  async execute(userId: string, toolName = 'get_user_medications', args: ToolArgs = {}) {
    try {
      switch (toolName) {
        case 'get_today_medication_schedule':
          return this.getDailyMedicationSchedule(userId, args);
        case 'get_user_bmi_analysis':
          return this.getUserBmiAnalysis(userId);
        case 'get_user_medications':
        default:
          return this.getUserMedications(userId);
      }
    } catch (err) {
      return { error: 'Không thể tải dữ liệu HealthMate cho chatbot' };
    }
  }

  private async getUserMedications(userId: string) {
    const userMeds = await this.prisma.userMedication.findMany({
      where: { userId, isActive: true },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: {
          where: { isActive: true },
          orderBy: { remindTime: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!userMeds || userMeds.length === 0) {
      return { message: 'Không tìm thấy đơn thuốc nào đang được theo dõi.' };
    }

    return {
      medications: userMeds.map((um) => {
        const stockEstimate = this.buildStockEstimate(
          um.stockCount,
          um.lowStockThreshold,
          um.reminderSchedules,
        );

        return {
          id: um.id,
          name: um.medication.name,
          genericName: um.medication.genericName,
          form: um.medication.form,
          dosage: um.dosage || um.medication.dosage,
          mealInstruction: um.mealInstruction,
          condition: um.condition?.displayName || um.conditionCustom,
          startDate: this.formatDate(um.startDate),
          endDate: this.formatDate(um.endDate),
          stockCount: um.stockCount,
          lowStockThreshold: um.lowStockThreshold,
          lowStockReminderEnabled: um.lowStockReminderEnabled,
          ...stockEstimate,
          schedules: um.reminderSchedules.map((schedule) => ({
            id: schedule.id,
            remindTime: schedule.remindTime,
            dosage: schedule.dosage || um.dosage || um.medication.dosage,
            quantity: schedule.quantity ?? um.quantity ?? 1,
            repeatType: schedule.repeatType,
            repeatDays: schedule.repeatDays,
            mealInstruction: um.mealInstruction || this.inferMealInstruction(schedule.remindTime),
          })),
        };
      }),
    };
  }

  private async getDailyMedicationSchedule(userId: string, args: ToolArgs) {
    const date = typeof args.date === 'string' && args.date ? args.date : this.todayInVietnam();
    const startOfDay = new Date(`${date}T00:00:00.000+07:00`);
    const endOfDay = new Date(`${date}T23:59:59.999+07:00`);
    const noonInVietnam = new Date(`${date}T12:00:00.000+07:00`);

    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      return { error: 'Ngày không hợp lệ. Vui lòng dùng định dạng YYYY-MM-DD.' };
    }

    const dayOfWeek = noonInVietnam.getUTCDay();

    const userMedications = await this.prisma.userMedication.findMany({
      where: { userId, isActive: true },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: {
          where: { isActive: true },
        },
      },
    });

    const dailyLogs = await this.prisma.medicationLog.findMany({
      where: {
        userMedication: { userId },
        actualAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const scheduleItems = userMedications.flatMap((um) => {
      if (um.startDate && new Date(um.startDate) > endOfDay) return [];
      if (um.endDate && new Date(um.endDate) < startOfDay) return [];

      return um.reminderSchedules
        .filter((schedule) => {
          const isDaily = schedule.repeatType === 'daily';
          const isSpecificDays =
            schedule.repeatType === 'specific_days' && schedule.repeatDays.includes(dayOfWeek);
          const isAsNeeded = schedule.repeatType === 'as_needed';

          return isDaily || isSpecificDays || isAsNeeded;
        })
        .map((schedule) => {
          const log = dailyLogs.find((l) => l.reminderScheduleId === schedule.id);
          const mealInstruction =
            um.mealInstruction || this.inferMealInstruction(schedule.remindTime);

          return {
            userMedicationId: um.id,
            reminderScheduleId: schedule.id,
            medicationName: um.medication.name,
            dosage: schedule.dosage || um.dosage || um.medication.dosage,
            quantity: schedule.quantity ?? um.quantity ?? 1,
            remindTime: schedule.remindTime,
            mealInstruction,
            condition: um.condition?.displayName || um.conditionCustom,
            stockCount: um.stockCount,
            lowStockThreshold: um.lowStockThreshold,
            needsRefill: this.needsRefill(um.stockCount, um.lowStockThreshold),
            status: log ? log.status : 'pending',
            actualAt: log ? log.actualAt : null,
            actualQuantity: log ? log.actualQuantity : null,
          };
        });
    });

    scheduleItems.sort((a, b) => this.compareReminderTime(a.remindTime, b.remindTime));

    return {
      date,
      timezone: 'Asia/Ho_Chi_Minh',
      totalDoses: scheduleItems.length,
      morning: scheduleItems.filter((item) => this.getDayPart(item.remindTime) === 'morning'),
      afternoon: scheduleItems.filter((item) => this.getDayPart(item.remindTime) === 'afternoon'),
      evening: scheduleItems.filter((item) => this.getDayPart(item.remindTime) === 'evening'),
      medications: scheduleItems,
      message:
        scheduleItems.length === 0
          ? 'Không có lịch uống thuốc nào cho ngày này.'
          : 'Đã tìm thấy lịch uống thuốc cho ngày này.',
    };
  }

  private async getUserBmiAnalysis(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return { message: 'Chưa tìm thấy hồ sơ sức khỏe của bạn.' };
    }

    const profile = user.profile;
    const weightKg = profile.weightKg ? Number(profile.weightKg) : null;
    const heightCm = profile.heightCm ? Number(profile.heightCm) : null;
    const calculated = this.calculateBMI(weightKg, heightCm);
    const bmi = profile.bmi ? Number(profile.bmi) : calculated.bmi;
    const bmiStatus = profile.bmiStatus || calculated.bmiStatus;
    const age = profile.dateOfBirth ? this.calculateAge(profile.dateOfBirth) : null;

    if (!bmi) {
      return {
        status: 'INCOMPLETE_DATA',
        message: 'Chưa đủ dữ liệu chiều cao/cân nặng để tính BMI.',
        heightCm,
        weightKg,
      };
    }

    const baseResult = {
      heightCm,
      weightKg,
      bmi: Number(bmi.toFixed(1)),
      bmiStatus,
      gender: profile.gender,
      age,
    };

    if (age === null || !profile.gender) {
      return {
        ...baseResult,
        comparisonStatus: 'INCOMPLETE_DATA',
        message: 'Đã có BMI hiện tại nhưng thiếu ngày sinh hoặc giới tính để so sánh theo nhóm.',
      };
    }

    const benchmark = await this.prisma.healthBenchmark.findFirst({
      where: {
        type: 'BMI',
        gender: profile.gender,
        ageMin: { lte: age },
        ageMax: { gte: age },
      },
    });

    if (!benchmark) {
      return {
        ...baseResult,
        comparisonStatus: 'NO_BENCHMARK_FOUND',
        message: 'Đã có BMI hiện tại nhưng chưa có dữ liệu benchmark phù hợp.',
      };
    }

    const peerBMI = Number(benchmark.value);
    const diff = bmi - peerBMI;
    const percentage = Math.abs((diff / peerBMI) * 100);
    let comparisonStatus = 'NORMAL';
    if (diff > 0.5) comparisonStatus = 'HIGHER';
    if (diff < -0.5) comparisonStatus = 'LOWER';

    return {
      ...baseResult,
      peerBMI: Number(peerBMI.toFixed(1)),
      difference: Number(diff.toFixed(1)),
      percentage: Number(percentage.toFixed(0)),
      comparisonStatus,
      peerDescription: benchmark.description,
    };
  }

  private buildStockEstimate(
    stockCount: number | null,
    lowStockThreshold: number,
    schedules: ScheduleForStockEstimate[],
  ) {
    if (stockCount === null) {
      return {
        needsRefill: false,
        estimatedDailyQuantity: null,
        estimatedDaysRemaining: null,
        estimatedRunOutDate: null,
      };
    }

    const estimatedDailyQuantity = schedules.reduce((total, schedule) => {
      const quantity = schedule.quantity ?? 1;

      if (schedule.repeatType === 'daily') return total + quantity;
      if (schedule.repeatType === 'specific_days') {
        return total + (quantity * schedule.repeatDays.length) / 7;
      }

      return total;
    }, 0);

    const fallbackDailyQuantity = estimatedDailyQuantity || 1;
    const estimatedDaysRemaining = Math.floor(stockCount / fallbackDailyQuantity);
    const estimatedRunOutDate = new Date();
    estimatedRunOutDate.setDate(estimatedRunOutDate.getDate() + estimatedDaysRemaining);

    return {
      needsRefill: this.needsRefill(stockCount, lowStockThreshold),
      estimatedDailyQuantity: Number(fallbackDailyQuantity.toFixed(2)),
      estimatedDaysRemaining,
      estimatedRunOutDate: this.formatDate(estimatedRunOutDate),
    };
  }

  private calculateBMI(weightKg: number | null, heightCm: number | null) {
    if (!weightKg || !heightCm || heightCm <= 0) {
      return { bmi: null, bmiStatus: null };
    }

    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    let bmiStatus = 'OBESE';

    if (bmi < 18.5) {
      bmiStatus = 'UNDERWEIGHT';
    } else if (bmi < 25) {
      bmiStatus = 'NORMAL';
    } else if (bmi < 30) {
      bmiStatus = 'OVERWEIGHT';
    }

    return { bmi, bmiStatus };
  }

  private calculateAge(dateOfBirth: Date) {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDelta = today.getMonth() - dateOfBirth.getMonth();

    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }

    return age;
  }

  private todayInVietnam() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  private formatDate(date: Date | null) {
    return date ? date.toISOString().slice(0, 10) : null;
  }

  private inferMealInstruction(remindTime: string | null) {
    if (!remindTime) return null;

    const [hour, minute] = remindTime.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

    return getMealInstructionFromTime(hour, minute);
  }

  private needsRefill(stockCount: number | null, lowStockThreshold: number) {
    return stockCount !== null && stockCount <= lowStockThreshold;
  }

  private compareReminderTime(a: string | null, b: string | null) {
    if (!a) return -1;
    if (!b) return 1;

    return a.localeCompare(b);
  }

  private getDayPart(remindTime: string | null) {
    if (!remindTime) return 'morning';

    const hour = parseInt(remindTime.split(':')[0], 10);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';

    return 'evening';
  }
}
