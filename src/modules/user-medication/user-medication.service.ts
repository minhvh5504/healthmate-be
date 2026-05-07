import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserMedicationDto } from './dto/create-user-medication.dto';
import { UpdateUserMedicationDto } from './dto/update-user-medication.dto';
import { ScanMedicationDto } from './dto/scan-medication.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserMedicationService {
  constructor(private prisma: PrismaService) {}

  async create(createUserMedicationDto: CreateUserMedicationDto, userId: string) {
    // 1. Verify medication exists
    const medication = await this.prisma.medication.findUnique({
      where: { id: createUserMedicationDto.medicationId },
    });

    if (!medication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'Medication not found', 404),
      );
    }

    // 2. Check condition if provided
    if (createUserMedicationDto.conditionId) {
      const condition = await this.prisma.medicationCondition.findUnique({
        where: { id: createUserMedicationDto.conditionId },
      });
      if (!condition) {
        throw new NotFoundException(
          ResponseHelper.error('CONDITION_NOT_FOUND', 'Condition not found', 404),
        );
      }
    }

    // 3. Create UserMedication
    const userMedication = await this.prisma.userMedication.create({
      data: {
        userId,
        ...createUserMedicationDto,
      },
      include: {
        medication: true,
        condition: true,
      },
    });

    return ResponseHelper.success(
      userMedication,
      MessageCodes.MEDICATION_CREATED,
      'User medication created successfully',
    );
  }

  async scan(scanDto: ScanMedicationDto, userId: string) {
    const { scannedText, rawScannedData } = scanDto;

    // Remove noise
    const cleanText = scannedText.trim().replace(/\n/g, ' ');

    // 1. Try to find existing medications
    const keywords = cleanText.split(' ').filter((w) => w.length > 2);

    let matchedMedicationId: string | null = null;

    if (keywords.length > 0) {
      const candidates = await this.prisma.medication.findMany({
        where: {
          OR: [
            ...keywords.map((kw) => ({
              name: { contains: kw, mode: 'insensitive' as Prisma.QueryMode },
            })),
            ...keywords.map((kw) => ({
              genericName: { contains: kw, mode: 'insensitive' as Prisma.QueryMode },
            })),
          ],
        },
        take: 20,
      });

      if (candidates.length > 0) {
        // Evaluate candidates to prevent false positives
        const scoredCandidates = candidates.map((candidate) => {
          const nameLower = candidate.name.toLowerCase();
          const genericLower = (candidate.genericName || '').toLowerCase();

          let score = 0;
          let matchedKeywordsCount = 0;

          for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            const matchesName = nameLower.includes(kwLower);
            const matchesGeneric = genericLower.includes(kwLower);

            if (matchesName || matchesGeneric) {
              score += kw.length;
              matchedKeywordsCount++;
            }
          }

          return { candidate, score, matchedKeywordsCount };
        });

        scoredCandidates.sort((a, b) => b.score - a.score);
        const bestMatch = scoredCandidates[0];

        // Strict threshold
        if (
          bestMatch.matchedKeywordsCount >= 2 ||
          (bestMatch.matchedKeywordsCount === 1 && bestMatch.score >= 5)
        ) {
          matchedMedicationId = bestMatch.candidate.id;
        }
      }
    }

    // 2. Create ScanTask instead of UserMedication
    const scanTask = await this.prisma.medicationScanTask.create({
      data: {
        userId,
        medicationId: matchedMedicationId,
        status: matchedMedicationId ? 'SUCCESS' : 'FAILED',
        scannedText: cleanText,
        rawScannedData: (rawScannedData as Prisma.InputJsonValue) ?? {
          source: 'OCR',
          rawText: cleanText,
        },
      },
      include: {
        medication: true,
      },
    });

    return ResponseHelper.success(
      scanTask,
      matchedMedicationId ? 'MEDICATION.SCAN.SUCCESS' : 'MEDICATION.SCAN.FAILED',
      matchedMedicationId ? 'Medication matched successfully' : 'No matching medication found',
    );
  }

  async findAllScanTasks(userId: string) {
    const tasks = await this.prisma.medicationScanTask.findMany({
      where: { userId },
      include: {
        medication: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ResponseHelper.success(
      tasks,
      'SCAN_TASKS_RETRIEVED',
      'Scan tasks retrieved successfully',
    );
  }

  async deleteScanTask(id: string, userId: string) {
    const task = await this.prisma.medicationScanTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException(
        ResponseHelper.error('SCAN_TASK_NOT_FOUND', 'Scan task not found', 404),
      );
    }

    await this.prisma.medicationScanTask.delete({ where: { id } });

    return ResponseHelper.success(null, 'SCAN_TASK_DELETED', 'Scan task deleted successfully');
  }

  async findAllByUser(userId: string) {
    const userMedications = await this.prisma.userMedication.findMany({
      where: { userId, isActive: true },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ResponseHelper.success(
      userMedications,
      MessageCodes.MEDICATION_LIST_RETRIEVED,
      'User medications retrieved successfully',
    );
  }

  async findOne(id: string, userId: string) {
    const userMedication = await this.prisma.userMedication.findFirst({
      where: { id, userId },
      include: {
        medication: true,
        condition: true,
        reminderSchedules: true,
      },
    });

    if (!userMedication) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
      );
    }

    return ResponseHelper.success(
      userMedication,
      MessageCodes.MEDICATION_RETRIEVED,
      'User medication retrieved successfully',
    );
  }

  async update(id: string, userId: string, updateDto: UpdateUserMedicationDto) {
    // Verify ownership
    const existing = await this.prisma.userMedication.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
      );
    }

    if (updateDto.conditionId) {
      const condition = await this.prisma.medicationCondition.findUnique({
        where: { id: updateDto.conditionId },
      });
      if (!condition) {
        throw new NotFoundException(
          ResponseHelper.error('CONDITION_NOT_FOUND', 'Condition not found', 404),
        );
      }
    }

    const updated = await this.prisma.userMedication.update({
      where: { id },
      data: updateDto,
      include: {
        medication: true,
        condition: true,
      },
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.MEDICATION_UPDATED,
      'User medication updated successfully',
    );
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.userMedication.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.MEDICATION_NOT_FOUND, 'User medication not found', 404),
      );
    }

    // Soft delete or hard delete based on preference. Here we do hard delete.
    // Actually, maybe update isActive = false
    await this.prisma.userMedication.update({
      where: { id },
      data: { isActive: false },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.MEDICATION_DELETED,
      'User medication deleted successfully',
    );
  }
}
