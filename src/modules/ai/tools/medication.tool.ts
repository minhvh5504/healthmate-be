import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MedicationTool {
  constructor(private readonly prisma: PrismaService) {}

  getToolDefinition() {
    return {
      type: 'function',
      function: {
        name: 'get_user_medications',
        description: 'Get the list of medications the user is currently tracking',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    };
  }

  async execute(userId: string) {
    try {
      const userMeds = await this.prisma.userMedication.findMany({
        where: { userId },
        include: { medication: true },
      });

      if (!userMeds || userMeds.length === 0) {
        return { message: 'Không tìm thấy đơn thuốc nào đang được theo dõi.' };
      }

      return userMeds.map((um) => ({
        id: um.id,
        name: um.medication.name,
      }));
    } catch (err) {
      return { error: 'Không thể tải danh sách thuốc' };
    }
  }
}
