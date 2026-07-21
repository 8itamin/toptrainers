/**
 * A program is deliberately modelled as typed training data, not generic CMS content.
 * The API contract will later add ids and server-managed timestamps around these forms.
 */
export interface ProgramSummary {
  id: string;
  title: string;
  weeks: number;
  status: 'draft' | 'published';
}

export interface TrainingSetInput {
  repetitions?: number;
  weightKg?: number;
  durationSeconds?: number;
  restSeconds?: number;
}

export interface DayBlockInput {
  exerciseId: string;
  sets: readonly TrainingSetInput[];
}

export interface ProgramDayInput {
  dayNumber: number;
  blocks: readonly DayBlockInput[];
}

export interface ProgramWeekInput {
  weekNumber: number;
  days: readonly ProgramDayInput[];
}
