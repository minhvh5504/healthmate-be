import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrescriptionStatus, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Prescriptions')
@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['startDate'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Prescription image file' },
        doctorName: { type: 'string' },
        clinicName: { type: 'string' },
        imageUrl: { type: 'string', description: 'Optional image URL when not uploading file' },
        imagePublicId: { type: 'string' },
        startDate: { type: 'string', example: '2026-06-19' },
        endDate: { type: 'string', example: '2026-06-26' },
        note: { type: 'string' },
        status: { enum: Object.values(PrescriptionStatus) },
      },
    },
  })
  @ApiOperation({ summary: 'Create a prescription for the current user' })
  @ApiResponse({ status: 201, description: 'Prescription created successfully' })
  create(
    @Body() dto: CreatePrescriptionDto,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.prescriptionsService.create(dto, req.user.id, file);
  }

  @Get()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get prescriptions of the current user' })
  @ApiQuery({ name: 'status', enum: PrescriptionStatus, required: false })
  @ApiResponse({ status: 200, description: 'Prescriptions retrieved successfully' })
  findAll(
    @Request() req,
    @Query('status', new ParseEnumPipe(PrescriptionStatus, { optional: true }))
    status?: PrescriptionStatus,
  ) {
    return this.prescriptionsService.findAllByUser(req.user.id, status);
  }

  @Get('status/:status')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get prescriptions by status of the current user' })
  @ApiResponse({ status: 200, description: 'Prescriptions retrieved successfully' })
  findByStatus(
    @Param('status', new ParseEnumPipe(PrescriptionStatus)) status: PrescriptionStatus,
    @Request() req,
  ) {
    return this.prescriptionsService.findAllByUser(req.user.id, status);
  }

  @Get(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a prescription by ID' })
  @ApiResponse({ status: 200, description: 'Prescription retrieved successfully' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.prescriptionsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Update a prescription' })
  @ApiResponse({ status: 200, description: 'Prescription updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionDto,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.prescriptionsService.update(id, req.user.id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a prescription' })
  @ApiResponse({ status: 200, description: 'Prescription deleted successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.prescriptionsService.remove(id, req.user.id);
  }
}
