// @vitest-environment jsdom

import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeAll, describe, expect, it } from 'vitest';

import { ExerciseEditorComponent } from './exercise-editor.component';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

describe('exercise editor layout', () => {
  it('places description under the name, keeps direction single-value, and explains category choices', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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
});
