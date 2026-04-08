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
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MedicationService } from './medication.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Medication')
@Controller('medication')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

  @Post()
  @Roles(Role.admin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create a new medication' })
  @ApiResponse({ status: 201, description: 'Medication created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createMedicationDto: CreateMedicationDto, @Request() req) {
    const userId = req.user?.id;
    return this.medicationService.create(createMedicationDto, userId);
  }

  @Get()
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all medications' })
  @ApiResponse({ status: 200, description: 'Medications retrieved successfully' })
  findAll() {
    return this.medicationService.findAll();
  }

  @Get('search')
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search medications by name or generic name' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  search(@Query('q') query: string) {
    return this.medicationService.search(query);
  }

  @Get(':id')
  @Roles(Role.admin, Role.user)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a medication by ID' })
  @ApiResponse({ status: 200, description: 'Medication retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  findOne(@Param('id') id: string) {
    return this.medicationService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Update a medication' })
  @ApiResponse({ status: 200, description: 'Medication updated successfully' })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  update(@Param('id') id: string, @Body() updateMedicationDto: UpdateMedicationDto) {
    return this.medicationService.update(id, updateMedicationDto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Delete a medication' })
  @ApiResponse({ status: 200, description: 'Medication deleted successfully' })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  remove(@Param('id') id: string) {
    return this.medicationService.remove(id);
  }
}
