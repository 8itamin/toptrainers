// @vitest-environment jsdom

import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { ExercisesApi, ProgramsApi, WorkoutsApi } from '@toptrainers/shared/data-access';
import type { ExerciseResponse, WorkoutCreate, WorkoutResponse } from '@toptrainers/shared/contracts';
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

const workout: WorkoutResponse = {
  id: 'workout-1', trainer_id: 'trainer-1', title: 'Ноги + кор', description: 'Силовая',
  blocks: [{ id: 'block-1', kind: 'main', title: 'Сила', exercises: [
    { id: 'item-1', exercise_id: exercise.id, sets: 3, reps: 10, weight_kg: 50, rest_seconds: 60 },
  ] }],
};

const cardioExercise: ExerciseResponse = {
  ...exercise, id: 'exercise-2', title: 'Бег', direction: 'cardio',
  muscle_group: 'Всё тело', muscle_groups: ['Всё тело'], thumbnail_url: null,
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
        { provide: WorkoutsApi, useValue: { list: () => of([workout]), replace: () => of(workout) } },
        { provide: ProgramsApi, useValue: { list: () => of([]) } },
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

  it('edits title and numeric parameters and saves the workout through the API', async () => {
    let savedTitle = '';
    let savedRest = 0;
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: ExercisesApi, useValue: { list: () => of([exercise]) } },
      { provide: WorkoutsApi, useValue: {
        list: () => of([workout]),
        replace: (_id: string, payload: { title: string; blocks: Array<{ exercises: Array<{ rest_seconds?: number }> }> }) => {
          savedTitle = payload.title;
          savedRest = payload.blocks[0].exercises[0].rest_seconds ?? 0;
          return of({ ...workout, title: payload.title });
        },
      } },
      { provide: ProgramsApi, useValue: { list: () => of([]) } },
    ] });
    const fixture = TestBed.createComponent(LibraryHubComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.tabs button'))
      .find((button) => button.textContent?.includes('Тренировки'))?.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.workout-row')?.click();
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector<HTMLInputElement>('input[aria-label="Название тренировки"]');
    expect(title).toBeTruthy();
    if (!title) throw new Error('Title input is missing');
    title.value = 'Новая сила';
    title.dispatchEvent(new Event('input'));
    const rest = fixture.nativeElement.querySelector<HTMLInputElement>('input[aria-label="Отдых, секунды"]');
    if (!rest) throw new Error('Rest input is missing');
    rest.value = '120';
    rest.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.fill')?.click();
    await fixture.whenStable();

    expect(savedTitle).toBe('Новая сила');
    expect(savedRest).toBe(120);
    expect(fixture.nativeElement.querySelector('.workout-row .row-name')?.textContent).toContain('Новая сила');
  });

  it('adds and removes existing tags to filter exercise cards', async () => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: ExercisesApi, useValue: { list: () => of([exercise, cardioExercise]) } },
      { provide: WorkoutsApi, useValue: { list: () => of([workout]) } },
      { provide: ProgramsApi, useValue: { list: () => of([]) } },
    ] });
    const fixture = TestBed.createComponent(LibraryHubComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.tabs button'))
      .find((button) => button.textContent?.includes('Тренировки'))?.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.workout-row')?.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector<HTMLElement>('.workout-dialog');
    if (!dialog) throw new Error('Workout dialog is missing');
    expect(dialog?.querySelectorAll('.pick-card')).toHaveLength(2);
    const select = dialog.querySelector<HTMLSelectElement>('select[aria-label="Добавить тег"]');
    if (!select) throw new Error('Tag selector is missing');
    select.value = 'Ноги';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(dialog?.querySelectorAll('.pick-card')).toHaveLength(1);
    dialog?.querySelector<HTMLButtonElement>('[aria-label="Убрать тег Ноги"]')?.click();
    fixture.detectChanges();
    expect(dialog?.querySelectorAll('.pick-card')).toHaveLength(2);
  });

  it('creates a workout with a new block and a library exercise', async () => {
    let createdPayload: WorkoutCreate | null = null;
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: ExercisesApi, useValue: { list: () => of([exercise]) } },
      { provide: WorkoutsApi, useValue: {
        list: () => of([]),
        create: (payload: WorkoutCreate) => {
          createdPayload = payload;
          return of({ ...workout, title: payload.title });
        },
      } },
      { provide: ProgramsApi, useValue: { list: () => of([]) } },
    ] });
    const fixture = TestBed.createComponent(LibraryHubComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.tabs button'))
      .find((button) => button.textContent?.includes('Тренировки'))?.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.row-add')?.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector<HTMLElement>('.workout-dialog');
    if (!dialog) throw new Error('Workout dialog is missing');
    const title = dialog.querySelector<HTMLInputElement>('input[aria-label="Название тренировки"]');
    if (!title) throw new Error('Title input is missing');
    title.value = 'Новая тренировка';
    title.dispatchEvent(new Event('input'));
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('.dashed'))
      .find((button) => button.textContent?.includes('Блок'))?.click();
    fixture.detectChanges();
    dialog.querySelector<HTMLButtonElement>('.pick-card')?.click();
    fixture.detectChanges();
    dialog.querySelector<HTMLButtonElement>('.fill')?.click();
    await fixture.whenStable();

    expect(createdPayload?.title).toBe('Новая тренировка');
    expect(createdPayload?.blocks[0]?.title).toBe('Блок 1');
    expect(createdPayload?.blocks[0]?.exercises[0]?.exercise_id).toBe(exercise.id);
    expect(fixture.nativeElement.querySelector('.workout-row .row-name')?.textContent).toContain('Новая тренировка');
  });
});
