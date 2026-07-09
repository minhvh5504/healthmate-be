import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationConditionDto } from './dto/create-medication-condition.dto';
import { UpdateMedicationConditionDto } from './dto/update-medication-condition.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';

@Injectable()
export class MedicationConditionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create medication condition
   */
  async create(dto: CreateMedicationConditionDto) {
    const existing = await this.prisma.medicationCondition.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        ResponseHelper.error(MessageCodes.MEDICATION_CONDITION_SLUG_EXISTS, 'Slug đã tồn tại', 409),
      );
    }

    const condition = await this.prisma.medicationCondition.create({
      data: dto,
    });

    return ResponseHelper.success(
      condition,
      MessageCodes.MEDICATION_CONDITION_CREATED,
      'Tạo tình trạng dùng thuốc thành công',
    );
  }

  /**
   * Get all medication conditions
   */
  async findAll() {
    const conditions = await this.prisma.medicationCondition.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return ResponseHelper.success(
      conditions,
      MessageCodes.MEDICATION_CONDITION_LIST_RETRIEVED,
      'Lấy danh sách tình trạng dùng thuốc thành công',
    );
  }

  /**
   * Get active medication conditions
   */
  async findActive() {
    const conditions = await this.prisma.medicationCondition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return ResponseHelper.success(
      conditions,
      MessageCodes.MEDICATION_CONDITION_LIST_RETRIEVED,
      'Lấy danh sách tình trạng dùng thuốc đang hoạt động thành công',
    );
  }

  /**
   * Get medication condition by id
   */
  async findOne(id: string) {
    const condition = await this.prisma.medicationCondition.findUnique({
      where: { id },
    });

    if (!condition) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_NOT_FOUND,
          'Không tìm thấy tình trạng dùng thuốc',
          404,
        ),
      );
    }

    return ResponseHelper.success(
      condition,
      MessageCodes.MEDICATION_CONDITION_RETRIEVED,
      'Lấy tình trạng dùng thuốc thành công',
    );
  }

  /**
   * Update medication condition
   */
  async update(id: string, dto: UpdateMedicationConditionDto) {
    const existing = await this.prisma.medicationCondition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_NOT_FOUND,
          'Không tìm thấy tình trạng dùng thuốc',
          404,
        ),
      );
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.medicationCondition.findUnique({
        where: { slug: dto.slug },
      });
      if (slugExists) {
        throw new ConflictException(
          ResponseHelper.error(
            MessageCodes.MEDICATION_CONDITION_SLUG_EXISTS,
            'Slug đã tồn tại',
            409,
          ),
        );
      }
    }

    const updated = await this.prisma.medicationCondition.update({
      where: { id },
      data: dto,
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.MEDICATION_CONDITION_UPDATED,
      'Cập nhật tình trạng dùng thuốc thành công',
    );
  }

  /**
   * Delete medication condition
   */
  async remove(id: string) {
    const existing = await this.prisma.medicationCondition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_NOT_FOUND,
          'Không tìm thấy tình trạng dùng thuốc',
          404,
        ),
      );
    }

    await this.prisma.medicationCondition.delete({
      where: { id },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.MEDICATION_CONDITION_DELETED,
      'Xóa tình trạng dùng thuốc thành công',
    );
  }
}
