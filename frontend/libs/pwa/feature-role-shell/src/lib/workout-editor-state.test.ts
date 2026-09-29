import { expect, it } from 'vitest';
import type { ExerciseResponse, ProgramResponse, WorkoutResponse } from '@toptrainers/shared/contracts';

import { draftFromWorkout, programUsage, summarizeWorkout, workoutPayload } from './workout-editor-state';

const exercise: ExerciseResponse = {
  id: 'exercise-1', trainer_id: 'trainer-1', title: 'Присед', direction: 'strength',
  muscle_group: 'Ноги', muscle_groups: ['Ноги', 'Кор'],
};

const workout: WorkoutResponse = {
  id: 'workout-1', trainer_id: 'trainer-1', title: 'Ноги', description: 'Сила',
  blocks: [{ id: 'block-1', title: 'Тяжёлый', kind: 'main', exercises: [
    { id: 'item-1', exercise_id: exercise.id, sets: 4, reps: 8, weight_kg: 75, rest_seconds: 90 },
  ] }],
};

it('round-trips an editable workout without losing block names or rest', () => {
  const draft = draftFromWorkout(workout);
  draft.title = 'Ноги и кор';
  draft.blocks[0].exercises[0].rest_seconds = 120;

  expect(workoutPayload(draft)).toEqual({
    title: 'Ноги и кор', description: 'Сила',
    blocks: [{ title: 'Тяжёлый', kind: 'main', exercises: [
      { exercise_id: exercise.id, sets: 4, reps: 8, weight_kg: 75, rest_seconds: 120 },
    ] }],
  });
});

it('derives totals, duration, tags and muscle load from exercise data', () => {
  const summary = summarizeWorkout(draftFromWorkout(workout), [exercise]);

  expect(summary.exerciseCount).toBe(1);
  expect(summary.totalSets).toBe(4);
  expect(summary.durationMinutes).toBe(8);
  expect(summary.tags).toEqual(['Сила', 'Ноги', 'Кор']);
  expect(summary.load).toEqual([{ name: 'Ноги', sets: 4 }, { name: 'Кор', sets: 4 }]);
});

it('counts how often the workout occurs in each program', () => {
  const programs = [{ id: 'program-1', title: 'Старт', duration_weeks: 4,
    slots: [
      { id: 'slot-1', week_number: 1, day_number: 1, workout_id: workout.id },
      { id: 'slot-2', week_number: 2, day_number: 1, workout_id: workout.id },
      { id: 'slot-3', week_number: 2, day_number: 2, workout_id: 'other' },
    ],
  }] as ProgramResponse[];

  expect(programUsage(workout.id, programs)).toEqual([{ title: 'Старт · 4 нед', count: 2 }]);
});
