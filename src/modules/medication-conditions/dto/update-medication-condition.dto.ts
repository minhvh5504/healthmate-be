import { PartialType } from '@nestjs/swagger';
import { CreateMedicationConditionDto } from './create-medication-condition.dto';

export class UpdateMedicationConditionDto extends PartialType(CreateMedicationConditionDto) {}
