import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { WorkoutAssignmentsApi } from '@toptrainers/shared/data-access';

import {
  assignmentIdFromQueryParam,
  clientAssignmentDetailsQueryParams,
  clientAssignmentReadErrorMessage,
  type ClientWorkoutAssignmentDetails,
  toClientAssignmentDetails,
} from './client-workout-assignment-view';
import { playerQueryParams } from './workout-execution-view';

@Component({
  selector: 'tt-client-workout-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="screen">
      <header class="app-header">
        <a class="back" routerLink="/client" aria-label="Вернуться к экрану Сегодня">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Сегодня
        </a>
      </header>

      @if (loading()) {
        <section class="state" aria-live="polite">Загружаем назначенную тренировку…</section>
      } @else if (errorMessage()) {
        <section class="state state--error" role="alert">
          {{ errorMessage() }}
          <a routerLink="/client">Вернуться к тренировкам на сегодня</a>
        </section>
      } @else if (assignment(); as item) {
        <section class="workout-heading" aria-labelledby="workout-title">
          <p>НАЗНАЧЕННАЯ ТРЕНИРОВКА · {{ item.status }}</p>
          <h1 id="workout-title">{{ item.title }}</h1>
          <div class="workout-meta">
            <span>{{ item.exerciseCount }} упражнений</span>
            <span>{{ item.scheduledDate }}</span>
          </div>
          @if (item.description) {
            <p class="description">{{ item.description }}</p>
          }
        </section>

        <section class="exercise-list" aria-label="Упражнения назначенной тренировки">
          @for (block of item.blocks; track block.position) {
            <h2>{{ block.kind }}</h2>
            @for (exercise of block.exercises; track exercise.position) {
              <article class="exercise">
                @if (exercise.thumbnail_url) {
                  <img class="exercise-media" [src]="exercise.thumbnail_url" [alt]="exercise.title" />
                } @else {
                  <span class="exercise-media exercise-media--placeholder" aria-hidden="true">{{ exercise.position + 1 }}</span>
                }
                <span class="exercise-copy">
                  <strong>{{ exercise.title }}</strong>
                  <small class="chips">
                    <i>{{ exercise.sets }} × {{ exercise.reps }}</i>
                    @if (exercise.weight_kg !== null && exercise.weight_kg !== undefined) {
                      <i class="chip--lime">{{ exercise.weight_kg }} кг</i>
                    }
                  </small>
                  @if (exercise.instruction) {
                    <span class="instruction">{{ exercise.instruction }}</span>
                  }
                </span>
              </article>
            }
          }
        </section>

        <footer class="action-bar">
          <a class="cta" routerLink="/client/workout/player" [queryParams]="playerParams(item.id)">
            Перейти к тренировке
          </a>
        </footer>
      }

      <nav class="tabbar" aria-label="Навигация клиента">
        <a class="tab" routerLink="/client"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg><span>Сегодня</span></a>
        <a class="tab" href="#calendar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg><span>Календарь</span></a>
        @if (assignment(); as item) {
          <a class="tab is-active" routerLink="/client/workout" [queryParams]="detailsQueryParams(item.id)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Тренировка</span></a>
        } @else {
          <span class="tab is-active" aria-current="page"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Тренировка</span></span>
        }
        <a class="tab" href="#competitions"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg><span>Соревн.</span></a>
        <a class="tab" href="#profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg><span>Профиль</span></a>
      </nav>
    </main>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; padding-bottom: calc(10.5rem + env(safe-area-inset-bottom)); background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .app-header { display: flex; align-items: center; padding: 1rem 1.25rem .75rem; }
    .back { display: inline-flex; align-items: center; gap: .375rem; color: #8a94a6; font-size: .875rem; text-decoration: none; }
    .state { margin: .5rem 1.25rem; padding: 1rem; border-radius: .875rem; background: #1c222b; color: #8a94a6; line-height: 1.5; }
    .state--error { color: #ff9ba5; }
    .state a { display: block; margin-top: .75rem; color: #c9f24b; }
    .workout-heading { padding: .125rem 1.25rem 1rem; }
    .workout-heading > p:first-child, .exercise-list h2 { margin: 0; color: #c9f24b; font-family: 'JetBrains Mono', monospace; font-size: .625rem; letter-spacing: .12em; }
    .workout-heading h1 { margin: .5rem 0 0; color: #f5f7fa; font-family: 'Unbounded', sans-serif; font-size: 1.625rem; font-weight: 600; letter-spacing: -.04em; line-height: 1.12; }
    .workout-meta { display: flex; gap: .875rem; margin-top: .5rem; color: #8a94a6; font-size: .8125rem; }
    .description { margin: .75rem 0 0; color: #b7bfcb; line-height: 1.5; font-size: .875rem; }
    .exercise-list { display: flex; flex-direction: column; gap: .625rem; padding: .125rem 1.25rem 1rem; }
    .exercise-list h2 { margin: .375rem 0 .0625rem; color: #8a94a6; }
    .exercise { display: flex; align-items: flex-start; gap: .8125rem; min-height: 4.25rem; padding: .75rem .875rem; border-radius: .875rem; background: #1c222b; color: inherit; }
    .exercise-media { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; border-radius: .6875rem; object-fit: cover; }
    .exercise-media--placeholder { display: grid; place-items: center; background: #242b34; color: #8a94a6; font-family: 'JetBrains Mono', monospace; font-size: .6875rem; }
    .exercise-copy { min-width: 0; flex: 1; }
    .exercise-copy strong { display: block; color: #f5f7fa; font-size: .9375rem; font-weight: 600; }
    .chips { display: flex; gap: .375rem; margin-top: .25rem; color: #8a94a6; font-family: 'JetBrains Mono', monospace; font-size: .6875rem; }
    .chips i { border-radius: .375rem; padding: .1875rem .5rem; background: #14181d; color: #f5f7fa; font-style: normal; }
    .chips .chip--lime { color: #c9f24b; }
    .instruction { display: block; margin-top: .5rem; color: #8a94a6; font-size: .75rem; line-height: 1.45; }
    .action-bar { position: fixed; right: 0; bottom: calc(4.875rem + env(safe-area-inset-bottom)); left: 0; z-index: 1; padding: .875rem 1.25rem; border-top: 1px solid rgb(245 247 250 / 6%); background: #14181d; }
    .cta { display: flex; height: 3.5rem; align-items: center; justify-content: center; border-radius: .8125rem; background: #c9f24b; color: #14181d; font-size: 1rem; font-weight: 700; text-decoration: none; }
    .tabbar { position: fixed; z-index: 2; inset-inline: 0; bottom: 0; display: flex; justify-content: space-between; padding: .75rem 1.25rem calc(.75rem + env(safe-area-inset-bottom)); background: #14181d; border-top: 1px solid rgb(245 247 250 / 6%); }
    .tab { display: flex; flex-direction: column; align-items: center; gap: .25rem; color: #5b6472; text-decoration: none; font-size: .625rem; }.tab.is-active { color: #c9f24b; font-weight: 600; }
    @media (min-width: 720px) { .screen { max-width: 30rem; margin: 0 auto; } .action-bar,.tabbar { width: 30rem; right: auto; left: 50%; transform: translateX(-50%); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkoutListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly assignmentsApi = inject(WorkoutAssignmentsApi);

  protected readonly assignment = signal<ClientWorkoutAssignmentDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  constructor() {
    const assignmentId = assignmentIdFromQueryParam(
      this.route.snapshot.queryParamMap.get('assignment_id'),
    );
    if (!assignmentId) {
      this.errorMessage.set('Тренировка не выбрана. Откройте назначение с экрана «Сегодня».');
      this.loading.set(false);
      return;
    }

    this.assignmentsApi.get(assignmentId).subscribe({
      next: (assignment) => this.assignment.set(toClientAssignmentDetails(assignment)),
      error: (error: unknown) => {
        this.errorMessage.set(clientAssignmentReadErrorMessage(error));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  protected detailsQueryParams(assignmentId: string): { assignment_id: string } {
    return clientAssignmentDetailsQueryParams(assignmentId);
  }

  protected playerParams(assignmentId: string): { assignment_id: string } {
    return playerQueryParams(assignmentId);
  }
}
