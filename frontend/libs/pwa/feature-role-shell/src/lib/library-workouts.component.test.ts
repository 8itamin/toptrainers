// @vitest-environment jsdom

import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { ExercisesApi } from '@toptrainers/shared/data-access';
import type { ExerciseResponse } from '@toptrainers/shared/contracts';
import { of } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { LibraryHubComponent } from './library-hub.component';

const exercise: ExerciseResponse = {
  id: 'exercise-1',
  trainer_id: 'trainer-1',
  title: 'Румынская тяга',
  direction: 'strength',
  muscle_group: 'Ноги',
  muscle_groups: ['Ноги'],
  thumbnail_url: 'https://example.test/rdl.webp',
};

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => TestBed.resetTestingModule());

describe('workout library', () => {
  it('shows workout details in columns and opens a workout in a dialog with photo cards', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExercisesApi, useValue: { list: () => of([exercise]) } },
      ],
    });
    const fixture = TestBed.createComponent(LibraryHubComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const workoutsTab = Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.tabs button'))
      .find((button) => button.textContent?.includes('Тренировки'));
    workoutsTab?.click();
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector<HTMLElement>('.workout-row');
    expect(row?.querySelector('.workout-description')?.textContent).toBeTruthy();
    expect(row?.querySelector('.workout-tags')?.textContent).toBeTruthy();
    expect(row?.querySelector('.workout-exercise-count')?.textContent).toMatch(/\d/);
    expect(row?.querySelector('.workout-duration')?.textContent).toMatch(/мин/);

    row?.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector<HTMLElement>('[role="dialog"][aria-label="Тренировка Ноги + кор"]');
    expect(dialog).toBeTruthy();
    const card = dialog?.querySelector<HTMLElement>('.pick-card');
    expect(card?.textContent).toContain('Румынская тяга');
    expect(card?.querySelector('img')?.getAttribute('src')).toBe(exercise.thumbnail_url);

    dialog?.querySelector<HTMLButtonElement>('[aria-label="Закрыть тренировку"]')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();

    row?.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
