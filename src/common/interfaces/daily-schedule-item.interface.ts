export interface DailyScheduleItem {
  userMedicationId: string;
  reminderScheduleId: string;
  medicationName: string;
  dosage: string | null;
  remindTime: string | null;
  mealInstruction: string | null;
  status: string;
  logId: string | null;
  takenAt: Date | null;
}
