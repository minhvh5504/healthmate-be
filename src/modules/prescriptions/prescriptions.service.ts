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
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

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
        status: dto.status,
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

  async findAllByUser(userId: string, status?: PrescriptionStatus) {
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

  async findOne(id: string, userId: string) {
    const prescription = await this.findOwnedPrescription(id, userId);

    return ResponseHelper.success(
      prescription,
      MessageCodes.PRESCRIPTION_RETRIEVED,
      'Lấy đơn thuốc thành công',
    );
  }

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
        status: dto.status,
      },
    });

    return ResponseHelper.success(
      updated,
      MessageCodes.PRESCRIPTION_UPDATED,
      'Cập nhật đơn thuốc thành công',
    );
  }

  async remove(id: string, userId: string) {
    await this.findOwnedPrescription(id, userId);

    await this.prisma.prescription.delete({ where: { id } });

    return ResponseHelper.success(
      null,
      MessageCodes.PRESCRIPTION_DELETED,
      'Xóa đơn thuốc thành công',
    );
  }

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
}
