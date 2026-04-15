import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MedicationConditionsService } from './medication-conditions.service';
import { CreateMedicationConditionDto } from './dto/create-medication-condition.dto';
import { UpdateMedicationConditionDto } from './dto/update-medication-condition.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Medication Conditions')
@Controller('medication-conditions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MedicationConditionsController {
  constructor(private readonly medicationConditionsService: MedicationConditionsService) {}

  @Post()
  @Roles(Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create a new medication condition' })
  @ApiResponse({ status: 201, description: 'Condition created successfully' })
  create(@Body() dto: CreateMedicationConditionDto) {
    return this.medicationConditionsService.create(dto);
  }

  @Get()
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all active medication conditions' })
  @ApiResponse({ status: 200, description: 'Conditions retrieved successfully' })
  findActive() {
    return this.medicationConditionsService.findActive();
  }

  @Get('all')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Get all medication conditions (including inactive)' })
  @ApiResponse({ status: 200, description: 'All conditions retrieved successfully' })
  findAll() {
    return this.medicationConditionsService.findAll();
  }

  @Get(':id')
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific medication condition by ID' })
  @ApiResponse({ status: 200, description: 'Condition retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.medicationConditionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Update a medication condition' })
  @ApiResponse({ status: 200, description: 'Condition updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicationConditionDto) {
    return this.medicationConditionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Delete a medication condition' })
  @ApiResponse({ status: 200, description: 'Condition deleted successfully' })
  remove(@Param('id') id: string) {
    return this.medicationConditionsService.remove(id);
  }
}
