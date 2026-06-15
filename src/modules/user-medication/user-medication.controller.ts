import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserMedicationService } from './user-medication.service';
import { CreateUserMedicationDto } from './dto/create-user-medication.dto';
import { UpdateUserMedicationDto } from './dto/update-user-medication.dto';
import { ScanMedicationDto } from './dto/scan-medication.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('User Medication')
@Controller('user-medication')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UserMedicationController {
  constructor(private readonly userMedicationService: UserMedicationService) {}

  @Post()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user medication' })
  @ApiResponse({ status: 201, description: 'User medication created successfully' })
  create(@Body() dto: CreateUserMedicationDto, @Request() req) {
    return this.userMedicationService.create(dto, req.user.id);
  }

  @Post('scan')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['scannedText'],
      properties: {
        scannedText: { type: 'string' },
        shape: { type: 'string' },
        rawScannedData: {
          oneOf: [{ type: 'object' }, { type: 'string' }],
          description: 'Raw OCR data as JSON object or JSON string when using multipart/form-data',
        },
        file: { type: 'string', format: 'binary', description: 'Original color scan image' },
      },
    },
  })
  @ApiOperation({ summary: 'Process OCR text from MLKit and save the original scan image' })
  @ApiResponse({ status: 201, description: 'Generated medication list successfully' })
  scan(@Body() dto: ScanMedicationDto, @Request() req, @UploadedFile() file?: Express.Multer.File) {
    return this.userMedicationService.scan(dto, req.user.id, file);
  }

  @Get('scan-tasks')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all scan tasks' })
  findAllScanTasks(@Request() req) {
    return this.userMedicationService.findAllScanTasks(req.user.id);
  }

  @Delete('scan-tasks/:id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a scan task' })
  deleteScanTask(@Param('id') id: string, @Request() req) {
    return this.userMedicationService.deleteScanTask(id, req.user.id);
  }

  @Get()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all active medications of the current user' })
  @ApiResponse({ status: 200, description: 'Retrieved successfully' })
  findAll(@Request() req) {
    return this.userMedicationService.findAllByUser(req.user.id);
  }

  @Get('daily-schedule')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get daily medication schedule for a specific date' })
  @ApiResponse({ status: 200, description: 'Daily schedule retrieved successfully' })
  getDailySchedule(@Query('date') date: string, @Request() req) {
    if (!date) {
      // default to today if not provided
      const today = new Date();
      date = today.toISOString().split('T')[0];
    }
    return this.userMedicationService.getDailySchedule(req.user.id, date);
  }

  @Get(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific user medication by ID' })
  @ApiResponse({ status: 200, description: 'Retrieved successfully' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.userMedicationService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a user medication' })
  @ApiResponse({ status: 200, description: 'Updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateUserMedicationDto, @Request() req) {
    return this.userMedicationService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user medication permanently' })
  @ApiResponse({ status: 200, description: 'Deleted successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.userMedicationService.remove(id, req.user.id);
  }
}
