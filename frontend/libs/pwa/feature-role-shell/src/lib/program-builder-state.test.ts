import { describe, expect, it } from 'vitest';

import {
  createProgramDraft,
  programDraftPayload,
  setProgramDraftDuration,
  setProgramDraftSlot,
} from './program-builder-state';

describe('program builder state', () => {
  it('serializes an empty schedule as an empty slots array', () => {
    const draft = createProgramDraft();

    expect(programDraftPayload(draft)).toEqual({
      title: '',
      description: '',
      duration_weeks: 1,
      slots: [],
    });
  });

  it('keeps only the latest workout for a relative day', () => {
    const first = setProgramDraftSlot(createProgramDraft(), 2, 4, 'workout-a');
    const updated = setProgramDraftSlot(first, 2, 4, 'workout-b');

    expect(programDraftPayload(updated).slots).toEqual([
      { week_number: 2, day_number: 4, workout_id: 'workout-b' },
    ]);
  });

  it('removes a day instead of emitting a placeholder slot', () => {
    const scheduled = setProgramDraftSlot(createProgramDraft(), 1, 1, 'workout-a');
    const cleared = setProgramDraftSlot(scheduled, 1, 1, null);

    expect(programDraftPayload(cleared).slots).toEqual([]);
  });

  it('drops slots outside a shortened program duration', () => {
    const scheduled = setProgramDraftSlot(createProgramDraft(), 2, 1, 'workout-a');

    expect(programDraftPayload(setProgramDraftDuration(scheduled, 1)).slots).toEqual([]);
  });
});
