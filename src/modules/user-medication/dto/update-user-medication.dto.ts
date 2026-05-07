import { PartialType } from '@nestjs/swagger';
import { CreateUserMedicationDto } from './create-user-medication.dto';

export class UpdateUserMedicationDto extends PartialType(CreateUserMedicationDto) {}
