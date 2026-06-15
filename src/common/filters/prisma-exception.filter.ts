import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi máy chủ nội bộ';

    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        message = 'Bản ghi với giá trị này đã tồn tại';
        break;
      case 'P2025':
        // Không tìm thấy bản ghi
        status = HttpStatus.NOT_FOUND;
        message = 'Không tìm thấy bản ghi';
        break;
      case 'P2003':
        // Ràng buộc khóa ngoại không hợp lệ
        status = HttpStatus.BAD_REQUEST;
        message = 'Ràng buộc khóa ngoại không hợp lệ';
        break;
      default:
        // Lỗi Prisma không xác định
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
