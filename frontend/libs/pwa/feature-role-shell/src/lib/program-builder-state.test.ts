import { firstValueFrom, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  createProgramDraft,
  nextProgramIssueRequestId,
  programDraftPayload,
  releaseBusyOnFinalize,
  setProgramDraftDuration,
  setProgramDraftSlot,
  TRAINER_PROGRAM_BUILDER_NAVIGATION,
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

  it('retains the request ID when an issue command is retried', () => {
    const createRequestId = vi.fn(() => 'generated-request-id');

    expect(nextProgramIssueRequestId('first-request-id', createRequestId)).toBe(
      'first-request-id',
    );
    expect(createRequestId).not.toHaveBeenCalled();
  });

  it('releases a busy control after an HTTP error', async () => {
    let busy = true;

    await expect(
      firstValueFrom(
        releaseBusyOnFinalize(throwError(() => new Error('network')), () => {
          busy = false;
        }),
      ),
    ).rejects.toThrow('network');

    expect(busy).toBe(false);
  });

  it('keeps all five trainer destinations in Program Builder navigation', () => {
    expect(TRAINER_PROGRAM_BUILDER_NAVIGATION.map((item) => item.path)).toEqual([
      '/trainer',
      '/trainer/clients',
      '/trainer/programs',
      '/trainer/chats',
      '/trainer/competitions',
    ]);
  });
});
