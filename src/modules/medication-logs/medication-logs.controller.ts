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
} from '@nestjs/common';
import { MedicationLogsService } from './medication-logs.service';
import { CreateMedicationLogDto } from './dto/create-medication-log.dto';
import { UpdateMedicationLogDto } from './dto/update-medication-log.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Medication Logs')
@Controller('medication-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MedicationLogsController {
  constructor(private readonly medicationLogsService: MedicationLogsService) {}

  @Post()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new medication log' })
  @ApiResponse({ status: 201, description: 'Recorded successfully' })
  create(@Body() dto: CreateMedicationLogDto, @Request() req) {
    return this.medicationLogsService.create(dto, req.user.id);
  }

  @Get()
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get medication logs history' })
  @ApiResponse({ status: 200, description: 'Retrieved successfully' })
  findHistory(
    @Query('userMedicationId') userMedicationId: string,
    @Query('range') range: string, // day, week, month
    @Query('date') date: string, // YYYY-MM-DD
    @Request() req,
  ) {
    return this.medicationLogsService.findHistory(req.user.id, userMedicationId, range, date);
  }

  @Patch(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a medication log' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicationLogDto, @Request() req) {
    return this.medicationLogsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.user, Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a medication log' })
  remove(@Param('id') id: string, @Request() req) {
    return this.medicationLogsService.remove(id, req.user.id);
  }
}
