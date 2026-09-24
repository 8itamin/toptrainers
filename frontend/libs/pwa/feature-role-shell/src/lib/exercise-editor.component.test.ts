// @vitest-environment jsdom

import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ExercisesApi } from '@toptrainers/shared/data-access';
import { NEVER } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ExerciseEditorComponent } from './exercise-editor.component';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => TestBed.resetTestingModule());

describe('exercise editor layout', () => {
  it('places description under the name, keeps direction single-value, and explains category choices', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExercisesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ExerciseEditorComponent);

    fixture.detectChanges();

    const fields = Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('.fields > .field'));
    expect(fields[0]?.textContent).toContain('НАЗВАНИЕ');
    expect(fields[1]?.textContent).toContain('ОПИСАНИЕ');

    const selects = fixture.nativeElement.querySelectorAll<HTMLSelectElement>('.field-pair select');
    expect(selects).toHaveLength(1);
    expect(selects[0]?.value).toBe('strength');

    const categoryCards = fixture.nativeElement.querySelectorAll<HTMLElement>('.count-grid .count');
    expect(categoryCards).toHaveLength(4);
    expect(categoryCards[0]?.textContent).toContain('Сила');
    expect(categoryCards[0]?.textContent).toContain('ВЕС, КГ × ПОВТОРЕНИЯ');
  });

  it('starts upload on file selection and blocks saving while it is in progress', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExercisesApi, useValue: { createVideoUpload: () => NEVER } },
      ],
    });
    const fixture = TestBed.createComponent(ExerciseEditorComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['video'], 'squat.mp4', { type: 'video/mp4' });
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    input.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector<HTMLButtonElement>('.save')?.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector<HTMLElement>('.video-actions')?.textContent).toContain('Загрузка 0%');
  });

  it('offers a video frame or image file as a private cover', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExercisesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ExerciseEditorComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Сделать кадр обложкой');
    expect(fixture.nativeElement.textContent).toContain('Загрузить обложку');
  });

  it('uses the native video when a manual cover is requested from a view child', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExercisesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ExerciseEditorComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      previewUrl: { set(value: string | null): void };
      message(): string;
      captureThumbnail(): void;
    };
    component.previewUrl.set('blob:exercise-preview');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector<HTMLVideoElement>('video')!;
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 0 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 0 });
    Object.defineProperty(component, 'previewVideo', { value: () => ({ nativeElement: video }) });
    component.captureThumbnail();
    await new Promise((resolve) => setTimeout(resolve));

    expect(component.message()).toBe('');
  });
});
