/**
 * Get meal instruction slug based on hour and minute
 * Rules based on typical meal times
 */
export function getMealInstructionFromTime(hour: number, minute: number): string {
  const minutes = hour * 60 + minute;

  if (minutes <= 8 * 60) return 'before_breakfast';
  if (minutes <= 10 * 60) return 'after_breakfast';
  if (minutes <= 11 * 60 + 30) return 'between_meals';
  if (minutes <= 12 * 60 + 30) return 'before_lunch';
  if (minutes <= 14 * 60) return 'after_lunch';
  if (minutes <= 17 * 60 + 30) return 'between_meals';
  if (minutes <= 18 * 60 + 30) return 'before_dinner';
  if (minutes <= 20 * 60) return 'after_dinner';
  return 'before_sleep';
}
