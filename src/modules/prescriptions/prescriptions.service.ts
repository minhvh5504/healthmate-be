import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrescriptionStatus } from '@prisma/client';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@Injectable()
export class PrescriptionsService {
  private readonly vietnamTimeZone = 'Asia/Ho_Chi_Minh';

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  /**
   * Create prescription
   */
  async create(dto: CreatePrescriptionDto, userId: string, imageFile?: Express.Multer.File) {
    this.validateDateRange(dto.startDate, dto.endDate);

    if (!imageFile && !dto.imageUrl) {
      throw new BadRequestException(
        ResponseHelper.error(MessageCodes.FILE_UPLOAD_FAILED, 'Vui lòng chọn ảnh đơn thuốc', 400),
      );
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        userId,
        doctorName: dto.doctorName,
        clinicName: dto.clinicName,
        imageUrl: dto.imageUrl ?? '',
        imagePublicId: dto.imagePublicId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        note: dto.note,
        status: this.resolvePrescriptionStatus(dto.status, dto.endDate),
      },
    });

    try {
      if (!imageFile) {
        return ResponseHelper.success(
          prescription,
          MessageCodes.PRESCRIPTION_CREATED,
          'Tạo đơn thuốc thành công',
          201,
        );
      }

      const uploadedImage = await this.uploadService.uploadPrescriptionImage(
        imageFile,
        prescription.id,
      );

      const updatedPrescription = await this.prisma.prescription.update({
        where: { id: prescription.id },
        data: {
          imageUrl: uploadedImage.url,
          imagePublicId: uploadedImage.publicId,
        },
      });

      return ResponseHelper.success(
        updatedPrescription,
        MessageCodes.PRESCRIPTION_CREATED,
        'Tạo đơn thuốc thành công',
        201,
      );
    } catch (error) {
      await this.prisma.prescription.delete({ where: { id: prescription.id } }).catch(() => null);
      throw error;
    }
  }

  /**
   * Get prescriptions by user
   */
  async findAllByUser(userId: string, status?: PrescriptionStatus) {
    await this.completeExpiredPrescriptions();

    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    return ResponseHelper.success(
      prescriptions,
      MessageCodes.PRESCRIPTION_LIST_RETRIEVED,
      'Lấy danh sách đơn thuốc thành công',
    );
  }

  /**
   * Get prescription by id
   */
  async findOne(id: string, userId: string) {
    await this.completeExpiredPrescriptions();

    const prescription = await this.findOwnedPrescription(id, userId);

    return ResponseHelper.success(
      prescription,
      MessageCodes.PRESCRIPTION_RETRIEVED,
      'Lấy đơn thuốc thành công',
    );
  }

  /**
   * Update prescription
   */
  async update(
    id: string,
    userId: string,
    dto: UpdatePrescriptionDto,
    imageFile?: Express.Multer.File,
  ) {
    const existing = await this.findOwnedPrescription(id, userId);
    const startDate = dto.startDate ?? existing.startDate.toISOString();
    const endDate = dto.endDate === undefined ? existing.endDate?.toISOString() : dto.endDate;

    this.validateDateRange(startDate, endDate);

    const uploadedImage = imageFile
      ? await this.uploadService.uploadPrescriptionImage(imageFile, id)
      : null;

    const updated = await this.prisma.prescription.update({
      where: { id },
      data: {
        doctorName: dto.doctorName,
        clinicName: dto.clinicName,
        imageUrl: uploadedImage?.url ?? dto.imageUrl,
        imagePublicId: uploadedImage?.publicId ?? dto.imagePublicId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        note: dto.note,
        status: this.resolvePrescriptionStatus(dto.status ?? existing.status, endDate),
      },
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.PRESCRIPTION_UPDATED,
      'Cập nhật đơn thuốc thành công',
    );
  }

  /**
   * Delete prescription
   */
  async remove(id: string, userId: string) {
    await this.findOwnedPrescription(id, userId);

    await this.prisma.prescription.delete({ where: { id } });

    return ResponseHelper.success(
      null,
      MessageCodes.PRESCRIPTION_DELETED,
      'Xóa đơn thuốc thành công',
    );
  }

  /**
   * Complete expired prescriptions
   */
  async completeExpiredPrescriptions() {
    const today = this.getTodayDateInVietnam();

    return this.prisma.prescription.updateMany({
      where: {
        status: PrescriptionStatus.ACTIVE,
        endDate: {
          lt: today,
        },
      },
      data: {
        status: PrescriptionStatus.COMPLETED,
      },
    });
  }

  /**
   * Find prescription owned by user
   */
  private async findOwnedPrescription(id: string, userId: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, userId },
    });

    if (!prescription) {
      throw new NotFoundException(
        ResponseHelper.error(MessageCodes.PRESCRIPTION_NOT_FOUND, 'Không tìm thấy đơn thuốc', 404),
      );
    }

    return prescription;
  }

  /**
   * Validate prescription date range
   */
  private validateDateRange(startDateValue?: string, endDateValue?: string | null) {
    if (!startDateValue || !endDateValue) {
      return;
    }

    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);

    if (endDate < startDate) {
      throw new BadRequestException(
        ResponseHelper.error(
          MessageCodes.PRESCRIPTION_INVALID_DATE_RANGE,
          'Ngày kết thúc không được trước ngày bắt đầu',
          400,
        ),
      );
    }
  }

  /**
   * Resolve prescription status
   */
  private resolvePrescriptionStatus(
    status: PrescriptionStatus | undefined,
    endDateValue?: string | Date | null,
  ) {
    if (!endDateValue) {
      return status;
    }

    const endDate = this.toDateOnly(endDateValue);
    const today = this.getTodayDateInVietnam();

    if (endDate < today) {
      return PrescriptionStatus.COMPLETED;
    }

    return status;
  }

  /**
   * Get today at Vietnam midnight
   */
  private getTodayDateInVietnam() {
    const dateStr = this.formatDateInVietnam(new Date());
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  /**
   * Convert value to date only
   */
  private toDateOnly(dateValue: string | Date) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  /**
   * Format date in Vietnam timezone
   */
  private formatDateInVietnam(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.vietnamTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }
}
