import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationConditionDto } from './dto/create-medication-condition.dto';
import { UpdateMedicationConditionDto } from './dto/update-medication-condition.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';

@Injectable()
export class MedicationConditionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMedicationConditionDto) {
    const existing = await this.prisma.medicationCondition.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_SLUG_EXISTS,
          'Slug already exists',
          409,
        ),
      );
    }

    const condition = await this.prisma.medicationCondition.create({
      data: dto,
    });

    return ResponseHelper.success(
      condition,
      MessageCodes.MEDICATION_CONDITION_CREATED,
      'Medication condition created successfully',
    );
  }

  async findAll() {
    const conditions = await this.prisma.medicationCondition.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return ResponseHelper.success(
      conditions,
      MessageCodes.MEDICATION_CONDITION_LIST_RETRIEVED,
      'Medication conditions retrieved successfully',
    );
  }

  async findActive() {
    const conditions = await this.prisma.medicationCondition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return ResponseHelper.success(
      conditions,
      MessageCodes.MEDICATION_CONDITION_LIST_RETRIEVED,
      'Active medication conditions retrieved successfully',
    );
  }

  async findOne(id: string) {
    const condition = await this.prisma.medicationCondition.findUnique({
      where: { id },
    });

    if (!condition) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_NOT_FOUND,
          'Medication condition not found',
          404,
        ),
      );
    }

    return ResponseHelper.success(
      condition,
      MessageCodes.MEDICATION_CONDITION_RETRIEVED,
      'Medication condition retrieved successfully',
    );
  }

  async update(id: string, dto: UpdateMedicationConditionDto) {
    const existing = await this.prisma.medicationCondition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_NOT_FOUND,
          'Medication condition not found',
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
            'Slug already exists',
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
      'Medication condition updated successfully',
    );
  }

  async remove(id: string) {
    const existing = await this.prisma.medicationCondition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(
          MessageCodes.MEDICATION_CONDITION_NOT_FOUND,
          'Medication condition not found',
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
      'Medication condition deleted successfully',
    );
  }
}
