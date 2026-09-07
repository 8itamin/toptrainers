import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import type { ProgramResponse, ProgramSlotWrite } from '@toptrainers/shared/contracts';

import { canIssueProgram, programOperationPath, replaceProgramSlot } from './programs';

function programFixture(slots: ProgramSlotWrite[]): ProgramResponse {
  return {
    id: 'program-1',
    trainer_id: 'trainer-1',
    title: 'Base',
    description: '',
    duration_weeks: 2,
    slots: slots.map((slot, index) => ({ ...slot, id: `slot-${index + 1}` })),
  };
}

describe('program data access', () => {
  it('uses generated relative paths for program operations', () => {
    expect(programOperationPath('list')).toBe('/programs');
    expect(programOperationPath('create')).toBe('/programs');
    expect(programOperationPath('replace', 'program/id')).toBe('/programs/program%2Fid');
    expect(programOperationPath('issue', 'program/id')).toBe('/programs/program%2Fid/assignments');
    expect(programOperationPath('cancelIssue', 'issue/id')).toBe(
      '/program-assignments/issue%2Fid/cancel',
    );
  });

  it('replaces a slot for the same relative day instead of adding a second workout', () => {
    const updated = replaceProgramSlot(
      [{ week_number: 1, day_number: 3, workout_id: 'workout-a' }],
      { week_number: 1, day_number: 3, workout_id: 'workout-b' },
    );

    expect(updated).toEqual([{ week_number: 1, day_number: 3, workout_id: 'workout-b' }]);
  });

  it('allows issuing only a program with at least one scheduled workout', () => {
    expect(canIssueProgram(programFixture([]))).toBe(false);
    expect(
      canIssueProgram(programFixture([{ week_number: 1, day_number: 1, workout_id: 'workout-1' }])),
    ).toBe(true);
  });
});
