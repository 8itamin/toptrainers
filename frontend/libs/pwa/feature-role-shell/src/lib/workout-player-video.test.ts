// @vitest-environment jsdom

import '@angular/compiler';

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of, throwError } from 'rxjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkoutAssignmentsApi, WorkoutExecutionsApi } from '@toptrainers/shared/data-access';

import { WorkoutPlayerComponent } from './workout-player.component';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

describe('workout player private exercise video', () => {
  it('requests and renders a signed URL only for snapshotted video media', () => {
    const exerciseStreamManifestUrl = vi.fn(() => 'https://api.example/stream.m3u8');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WorkoutAssignmentsApi,
          useValue: {
            get: () => of({
              id: 'assignment-1',
              status: 'PLANNED',
              scheduled_date: '2026-09-23',
              workout_snapshot: {
                title: 'Ноги', description: '', blocks: [{ kind: 'MAIN', position: 0, exercises: [{
                  source_exercise_id: 'exercise-1', position: 0, title: 'Присед', direction: 'strength',
                  muscle_group: 'Ноги', instruction: '', sets: 3, reps: 10, video_media_id: 'media-1',
                }] }],
              },
            }),
            exerciseStreamManifestUrl,
          },
        },
        { provide: WorkoutExecutionsApi, useValue: { get: () => throwError(() => new HttpErrorResponse({ status: 404 })) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ assignment_id: 'assignment-1' }) } } },
      ],
    });

    const fixture = TestBed.createComponent(WorkoutPlayerComponent);
    fixture.detectChanges();

    expect(exerciseStreamManifestUrl).toHaveBeenCalledWith('assignment-1', 'media-1');
    const component = fixture.componentInstance as unknown as {
      exerciseVideoUrl(mediaId: string): string | null;
    };
    expect(component.exerciseVideoUrl('media-1')).toBe(
      'https://api.example/stream.m3u8',
    );
  });
});
