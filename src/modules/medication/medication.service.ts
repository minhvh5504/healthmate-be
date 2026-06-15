import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';

@Injectable()
export class MedicationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create medication
   */
  async create(createMedicationDto: CreateMedicationDto, userId?: string) {
    const medication = await this.prisma.medication.create({
      data: {
        ...createMedicationDto,
        createdBy: userId,
      },
    });
    return ResponseHelper.success(
      medication,
      MessageCodes.MEDICATION_CREATED,
      'Tạo thuốc thành công',
      201,
    );
  }

  /**
   * Get all medications (Legacy)
   */
  async findAll() {
    const medications = await this.prisma.medication.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return ResponseHelper.success(
      medications,
      MessageCodes.MEDICATION_LIST_RETRIEVED,
      'Lấy danh sách thuốc thành công',
    );
  }

  /**
   * [Admin] Get all medications with pagination and search
   */
  async findAllAdmin(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [medications, total] = await Promise.all([
      this.prisma.medication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.medication.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        medications,
        total,
        page,
        limit,
      },
      MessageCodes.MEDICATION_LIST_RETRIEVED,
      'Lấy danh sách thuốc quản trị thành công',
    );
  }

  /**
   * Search medications
   */
  async search(query: string) {
    if (!query) {
      return ResponseHelper.success([], MessageCodes.MEDICATION_SEARCH_SUCCESS, 'Kết quả tìm kiếm');
    }

    const medications = await this.prisma.medication.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { genericName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10, // Limit results
    });

    return ResponseHelper.success(
      medications,
      MessageCodes.MEDICATION_SEARCH_SUCCESS,
      'Kết quả tìm kiếm',
    );
  }

  /**
   * Get medication by id
   */
  async findOne(id: string) {
    const medication = await this.prisma.medication.findUnique({
      where: { id },
    });

    if (!medication) {
      throw new NotFoundException('Không tìm thấy thuốc');
    }

    return ResponseHelper.success(
      medication,
      MessageCodes.MEDICATION_RETRIEVED,
      'Lấy thông tin thuốc thành công',
    );
  }

  /**
   * Update medication
   */
  async update(id: string, updateMedicationDto: UpdateMedicationDto) {
    await this.findOne(id); // Check existence

    const updatedMedication = await this.prisma.medication.update({
      where: { id },
      data: updateMedicationDto,
    });

    return ResponseHelper.success(
      updatedMedication,
      MessageCodes.MEDICATION_UPDATED,
      'Cập nhật thuốc thành công',
    );
  }

  /**
   * Delete medication
   */
  async remove(id: string) {
    await this.findOne(id); // Check existence

    await this.prisma.medication.delete({
      where: { id },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.MEDICATION_DELETED,
      'Xóa thuốc thành công',
    );
  }
}
