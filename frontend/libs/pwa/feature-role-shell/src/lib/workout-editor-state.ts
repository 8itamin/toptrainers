import type {
  ExerciseResponse, ProgramResponse, WorkoutBlockCreate, WorkoutCreate, WorkoutResponse,
} from '@toptrainers/shared/contracts';

export type BlockKind = WorkoutBlockCreate['kind'];

export interface DraftExercise {
  id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number;
}

export interface DraftBlock {
  id: string;
  title: string;
  kind: BlockKind;
  exercises: DraftExercise[];
}

export interface WorkoutDraft {
  title: string;
  description: string;
  blocks: DraftBlock[];
}

const DIRECTION_NAMES: Record<ExerciseResponse['direction'], string> = {
  strength: 'Сила', speed: 'Скорость', agility: 'Ловкость', cardio: 'Кардио',
};

export function exerciseTags(exercise: ExerciseResponse): string[] {
  return [DIRECTION_NAMES[exercise.direction], ...exercise.muscle_groups];
}

export function draftFromWorkout(workout: WorkoutResponse | null): WorkoutDraft {
  return {
    title: workout?.title ?? '',
    description: workout?.description ?? '',
    blocks: workout?.blocks.map((block) => ({
      id: block.id,
      title: block.title,
      kind: block.kind,
      exercises: block.exercises.map((item) => ({
        id: item.id,
        exercise_id: item.exercise_id,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg ?? null,
        rest_seconds: item.rest_seconds ?? 60,
      })),
    })) ?? [],
  };
}

export function workoutPayload(draft: WorkoutDraft): WorkoutCreate {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    blocks: draft.blocks.map((block) => ({
      title: block.title.trim(),
      kind: block.kind,
      exercises: block.exercises.map((item) => ({
        exercise_id: item.exercise_id,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        rest_seconds: item.rest_seconds,
      })),
    })),
  };
}

export function summarizeWorkout(draft: WorkoutDraft, exercises: readonly ExerciseResponse[]) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const load = new Map<string, number>();
  const tags = new Set<string>();
  let exerciseCount = 0;
  let totalSets = 0;
  let durationSeconds = 0;
  for (const block of draft.blocks) {
    for (const item of block.exercises) {
      exerciseCount += 1;
      totalSets += item.sets;
      durationSeconds += item.sets * item.reps * 3 + Math.max(0, item.sets - 1) * item.rest_seconds + 60;
      const exercise = byId.get(item.exercise_id);
      if (!exercise) continue;
      for (const tag of exerciseTags(exercise)) tags.add(tag);
      for (const group of exercise.muscle_groups) load.set(group, (load.get(group) ?? 0) + item.sets);
    }
  }
  return {
    exerciseCount,
    totalSets,
    durationMinutes: Math.ceil(durationSeconds / 60),
    tags: [...tags],
    load: [...load].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets),
  };
}

export function programUsage(workoutId: string | null, programs: readonly ProgramResponse[]) {
  if (!workoutId) return [];
  return programs.flatMap((program) => {
    const count = program.slots.filter((slot) => slot.workout_id === workoutId).length;
    return count ? [{ title: `${program.title} · ${program.duration_weeks ?? 1} нед`, count }] : [];
  });
}
