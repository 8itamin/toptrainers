import { describe, expect, it } from 'vitest';

import {
  addMuscleGroup,
  emptyExerciseDraft,
  removeMuscleGroup,
  canSaveExercise,
  canSaveExerciseWithThumbnail,
  validateVideoFile,
} from './exercise-editor-state';

describe('exercise editor draft state', () => {
  it('rejects a 200 MiB plus one byte MOV before upload', () => {
    expect(
      validateVideoFile({
        type: 'video/quicktime',
        size: 200 * 1024 * 1024 + 1,
      } as File),
    ).toEqual({ kind: 'error', message: 'Видео должно быть не больше 200 МБ.' });
  });

  it('keeps selected muscle groups ordered and removable', () => {
    const draft = addMuscleGroup(emptyExerciseDraft(), 'Спина');
    const withSecondGroup = addMuscleGroup(draft, 'Руки');

    expect(withSecondGroup.muscleGroups).toEqual(['Спина', 'Руки']);
    expect(removeMuscleGroup(withSecondGroup, 'Спина').muscleGroups).toEqual(['Руки']);
  });

  it('blocks saving while the selected video is uploading', () => {
    expect(canSaveExercise('uploading')).toBe(false);
    expect(canSaveExercise('idle')).toBe(true);
    expect(canSaveExercise('uploaded')).toBe(true);
    expect(canSaveExercise('failed')).toBe(true);
  });

  it('requires a confirmed cover after a newly selected video', () => {
    expect(canSaveExerciseWithThumbnail('uploaded', 'uploading', true)).toBe(false);
    expect(canSaveExerciseWithThumbnail('uploaded', 'failed', true)).toBe(false);
    expect(canSaveExerciseWithThumbnail('uploaded', 'uploaded', true)).toBe(true);
    expect(canSaveExerciseWithThumbnail('uploaded', 'idle', false)).toBe(true);
  });
});
