import { describe, expect, it } from 'vitest';

import { closeExerciseModal, openExerciseModal } from './exercise-modal-state';

describe('exercise modal state', () => {
  it('opens creation and edit modes, then closes back to the library', () => {
    expect(openExerciseModal('create')).toEqual({ mode: 'create' });
    expect(openExerciseModal('edit')).toEqual({ mode: 'edit' });
    expect(closeExerciseModal()).toBeNull();
  });
});
