export interface DailyScheduleItem {
  userMedicationId: string;
  reminderScheduleId: string;
  medicationName: string;
  dosage: string | null;
  quantity: number;
  remindTime: string | null;
  mealInstruction: string | null;
  status: string;
  logId: string | null;
  actualAt: Date | null;
  actualQuantity: number | null;
}
