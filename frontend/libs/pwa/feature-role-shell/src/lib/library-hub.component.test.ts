import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./library-hub.component.ts', import.meta.url), 'utf8');

describe('exercise library filters', () => {
  it('starts with All directions, supports multiple muscle groups, and resets both filters', () => {
    expect(source).toContain("type Direction = 'all' |");
    expect(source).toContain("{ key: 'all', label: 'Все' }");
    expect(source).toContain("protected readonly direction = signal<Direction>('all')");
    expect(source).toContain('protected readonly selectedMuscles = signal<ReadonlySet<string>>(new Set())');
    expect(source).toContain("this.direction.set('all')");
    expect(source).toContain('this.selectedMuscles.set(new Set())');
  });

  it('labels the filter pane and keeps the category filter hidden', () => {
    expect(source).toContain('>Фильтры</h2>');
    expect(source).not.toContain('КАТЕГОРИЯ · ЧТО СЧИТАЕМ');
  });
});
