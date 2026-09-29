import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import { workoutOperationPath } from './workouts';

describe('workout data access paths', () => {
  it('uses generated list, create and encoded replace paths', () => {
    expect(workoutOperationPath('list')).toBe('/workouts');
    expect(workoutOperationPath('create')).toBe('/workouts');
    expect(workoutOperationPath('replace', 'workout / 1')).toBe('/workouts/workout%20%2F%201');
  });
});
