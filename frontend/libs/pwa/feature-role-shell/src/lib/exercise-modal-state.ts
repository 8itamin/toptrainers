export type ExerciseModalMode = 'create' | 'edit';

export interface ExerciseModalState {
  mode: ExerciseModalMode;
}

export function openExerciseModal(mode: ExerciseModalMode): ExerciseModalState {
  return { mode };
}

export function closeExerciseModal(): null {
  return null;
}
