import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '../interfaces/api-response.interface';

export class ApiException extends HttpException {
  constructor(
    errorCode: string,
    errorMessage: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    message: string = 'Thao tác thất bại',
  ) {
    const response: ApiResponse = {
      success: false,
      statusCode,
      message,
      messageCode: errorCode,
      errorMessage,
      errorCode,
      timestamp: new Date().toISOString(),
    };

    super(response, statusCode);
  }
}
