import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import { exerciseOperationPath } from './exercises';

describe('exercise data access paths', () => {
  it('encodes exercise and media IDs for private-video operations', () => {
    expect(exerciseOperationPath('update', 'exercise / 1')).toBe('/exercises/exercise%20%2F%201');
    expect(exerciseOperationPath('confirmVideoUpload', 'media / 1')).toBe(
      '/exercises/video-uploads/media%20%2F%201/confirm',
    );
  });
});
