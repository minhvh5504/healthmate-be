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
      'Medication created successfully',
      201,
    );
  }

  /**
   * Get all medications
   */
  async findAll() {
    const medications = await this.prisma.medication.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return ResponseHelper.success(
      medications,
      MessageCodes.MEDICATION_LIST_RETRIEVED,
      'All medications retrieved successfully',
    );
  }

  /**
   * Search medications
   */
  async search(query: string) {
    if (!query) {
      return ResponseHelper.success([], MessageCodes.MEDICATION_SEARCH_SUCCESS, 'Search results');
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
      'Search results',
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
      throw new NotFoundException('Medication not found');
    }

    return ResponseHelper.success(
      medication,
      MessageCodes.MEDICATION_RETRIEVED,
      'Medication retrieved successfully',
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
      'Medication updated successfully',
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
      'Medication deleted successfully',
    );
  }
}
