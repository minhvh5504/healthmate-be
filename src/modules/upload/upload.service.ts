import { Injectable, Inject } from '@nestjs/common';
import { extname } from 'path';
import { promises as fs } from 'fs';
import * as streamifier from 'streamifier';
import { v2 as CloudinaryType } from 'cloudinary';
import { CLOUDINARY } from 'src/common/providers/cloudinary.provider';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { PrismaService } from '../prisma/prisma.service';

export type UploadResult = {
  url: string; // secure URL of the uploaded image
  publicId: string; // Cloudinary public ID of the uploaded image
};

@Injectable()
export class UploadService {
  private readonly iconUploadDir = './uploads/icons';
  private readonly avatarUploadDir = './uploads/avatars';
  private readonly allowedExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryType,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload medication icon
   */
  async uploadIcon(
    file: Express.Multer.File | undefined,
  ): Promise<ReturnType<typeof ResponseHelper.success<UploadResult>>> {
    // Validate file
    this.validateFile(file);

    // Type guard ensures file is defined after validation
    if (!file) {
      throw new ApiException(
        MessageCodes.FILE_UPLOAD_FAILED,
        'Chưa cung cấp file',
        400,
        'Tải file lên thất bại',
      );
    }

    // Put icons in a folder (helps management in Cloudinary dashboard)
    const result = await this.uploadBufferToCloudinary(file, 'healthmate/icons');

    return ResponseHelper.success(
      result,
      MessageCodes.FILE_UPLOADED,
      'Tải biểu tượng lên thành công',
      201,
    );
  }

  /**
   * Delete medication icon
   */
  async deleteIcon(publicId: string | null | undefined): Promise<void> {
    if (!publicId) return;

    try {
      await this.cloudinary.uploader.destroy(publicId, {
        // for images, resource_type defaults to 'image'
        invalidate: true, // invalidates CDN caches
      });
    } catch (e) {
      // ignore if already deleted / not found
      console.log('Cloudinary delete failed:', publicId, e);
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(
    file: Express.Multer.File | undefined,
    userId?: string,
  ): Promise<ReturnType<typeof ResponseHelper.success<UploadResult>>> {
    // Validate file
    this.validateFile(file);

    // Type guard ensures file is defined after validation
    if (!file) {
      throw new ApiException(
        MessageCodes.FILE_UPLOAD_FAILED,
        'Chưa cung cấp file',
        400,
        'Tải file lên thất bại',
      );
    }

    const result = await this.uploadBufferToCloudinary(file, 'healthmate/avatars');

    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: result.url },
      });
    }

    return ResponseHelper.success(
      result,
      MessageCodes.FILE_UPLOADED,
      'Tải ảnh đại diện lên thành công',
      201,
    );
  }

  /**
   * Upload medication scan image
   */
  async uploadMedicationScanImage(file: Express.Multer.File | undefined): Promise<UploadResult> {
    this.validateFile(file);

    if (!file) {
      throw new ApiException(
        MessageCodes.FILE_UPLOAD_FAILED,
        'Chưa cung cấp file',
        400,
        'Tải file lên thất bại',
      );
    }

    return this.uploadBufferToCloudinary(file, 'healthmate/medication-scans');
  }

  /**
   * Upload prescription image
   */
  async uploadPrescriptionImage(
    file: Express.Multer.File | undefined,
    prescriptionId: string,
  ): Promise<UploadResult> {
    this.validateFile(file, 10 * 1024 * 1024);

    if (!file) {
      throw new ApiException(
        MessageCodes.FILE_UPLOAD_FAILED,
        'Chưa cung cấp file',
        400,
        'Tải ảnh đơn thuốc thất bại',
      );
    }

    return this.uploadBufferToCloudinary(file, `healthmate/prescriptions/${prescriptionId}`);
  }

  /**
   * Delete user avatar
   */
  async deleteAvatar(publicId: string | null | undefined): Promise<void> {
    if (!publicId) return;

    try {
      await this.cloudinary.uploader.destroy(publicId, {
        // for images, resource_type defaults to 'image'
        invalidate: true, // invalidates CDN caches
      });
    } catch (e) {
      // ignore if already deleted / not found
      console.log('Cloudinary delete failed:', publicId, e);
    }
  }

  /**
   * Upload buffer to Cloudinary
   */
  private async uploadBufferToCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    const toError = (e: unknown, fallback: string) =>
      e instanceof Error ? e : new Error(typeof e === 'string' ? e : fallback);

    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(toError(error, 'Tải ảnh lên Cloudinary thất bại'));
            return;
          }

          if (!result) {
            reject(new Error('Tải ảnh lên Cloudinary thất bại: không có kết quả'));
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Validate uploaded file
   */
  private validateFile(
    file: Express.Multer.File | undefined,
    maxFileSize = this.maxFileSize,
  ): void {
    if (!file) {
      throw new ApiException(
        MessageCodes.FILE_UPLOAD_FAILED,
        'Chưa cung cấp file',
        400,
        'Kiểm tra file thất bại',
      );
    }

    // Check file size
    if (file.size > maxFileSize) {
      throw new ApiException(
        MessageCodes.FILE_TOO_LARGE,
        `Kích thước file vượt quá giới hạn ${Math.round(maxFileSize / 1024 / 1024)}MB`,
        400,
        'Kiểm tra file thất bại',
      );
    }

    // Check file extension
    const ext = extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      throw new ApiException(
        MessageCodes.FILE_INVALID_TYPE,
        `Loại file không hợp lệ. Các loại được phép: ${this.allowedExtensions.join(', ')}`,
        400,
        'Kiểm tra file thất bại',
      );
    }

    // Check MIME type
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new ApiException(
        MessageCodes.FILE_INVALID_TYPE,
        'MIME type của file không hợp lệ',
        400,
        'Kiểm tra file thất bại',
      );
    }
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDir(uploadDir: string): Promise<void> {
    try {
      await fs.access(uploadDir);
    } catch {
      // Create missing directory
      await fs.mkdir(uploadDir, { recursive: true });
    }
  }
}
