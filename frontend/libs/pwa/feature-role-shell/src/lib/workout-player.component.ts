import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { WorkoutExecutionResponse } from '@toptrainers/shared/contracts';
import {
  isWorkoutExecutionNotFound,
  WorkoutAssignmentsApi,
  WorkoutExecutionsApi,
} from '@toptrainers/shared/data-access';

import {
  assignmentIdFromQueryParam,
  clientAssignmentDetailsQueryParams,
  clientAssignmentReadErrorMessage,
} from './client-workout-assignment-view';
import {
  executionActionForResponse,
  toWorkoutExecutionPlan,
  type WorkoutExecutionPlan,
} from './workout-execution-view';

@Component({
  selector: 'tt-workout-player',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="screen">
      <header class="app-header">
        @if (plan(); as item) {
          <a class="back" routerLink="/client/workout" [queryParams]="detailsParams(item.assignmentId)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            {{ item.title }}
          </a>
        } @else {
          <a class="back" routerLink="/client">Сегодня</a>
        }
      </header>

      @if (loading()) {
        <section class="state" aria-live="polite">Загружаем тренировку…</section>
      } @else if (errorMessage()) {
        <section class="state state--error" role="alert">
          {{ errorMessage() }}
          <a routerLink="/client">Вернуться к тренировкам на сегодня</a>
        </section>
      } @else if (plan(); as item) {
        <section class="heading">
          <p>ТРЕНИРОВКА · {{ executionStatusLabel() }}</p>
          <h1>{{ item.title }}</h1>
          <div class="meta">
            <span>{{ exerciseCount(item) }} упражнений</span>
            <span>{{ item.scheduledDate }}</span>
          </div>
          @if (item.description) {
            <div class="description">{{ item.description }}</div>
          }
        </section>

        <section class="execution-card" aria-live="polite">
          @if (execution(); as current) {
            <strong>{{ current.status === 'COMPLETED' ? 'Тренировка завершена' : 'Тренировка выполняется' }}</strong>
            <small>Статус и время выполнения подтверждены сервером.</small>
          } @else if (item.assignmentStatus === 'CANCELLED') {
            <strong>Тренировка отменена</strong>
            <small>Назначение доступно только для просмотра.</small>
          } @else {
            <strong>Тренировка ещё не начата</strong>
            <small>Старт создаст или вернёт существующее выполнение.</small>
          }
        </section>

        <section class="exercise-list" aria-label="План назначенной тренировки">
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
          @if (lifecycleAction() === 'start') {
            <button type="button" class="cta" [disabled]="mutating()" (click)="startExecution()">
              {{ mutating() ? 'Запускаем…' : 'Начать тренировку' }}
            </button>
          } @else if (lifecycleAction() === 'complete') {
            <button type="button" class="cta" [disabled]="mutating()" (click)="completeExecution()">
              {{ mutating() ? 'Завершаем…' : 'Завершить тренировку' }}
            </button>
          } @else {
            <button type="button" class="cta" disabled>{{ terminalActionLabel() }}</button>
          }
        </footer>
      }

      <nav class="tabbar" aria-label="Навигация клиента">
        <a class="tab" routerLink="/client"><span>Сегодня</span></a>
        @if (plan(); as item) {
          <a class="tab is-active" routerLink="/client/workout" [queryParams]="detailsParams(item.assignmentId)"><span>Тренировка</span></a>
        } @else {
          <span class="tab is-active"><span>Тренировка</span></span>
        }
      </nav>
    </main>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; padding-bottom: calc(10rem + env(safe-area-inset-bottom)); background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .app-header { display: flex; align-items: center; padding: 1rem 1.25rem .75rem; }
    .back { display: inline-flex; align-items: center; gap: .375rem; min-width: 0; color: #8a94a6; font-size: .875rem; text-decoration: none; }
    .state { margin: .5rem 1.25rem; padding: 1rem; border-radius: .875rem; background: #1c222b; color: #8a94a6; line-height: 1.5; }
    .state--error { color: #ff9ba5; }
    .state a { display: block; margin-top: .75rem; color: #c9f24b; }
    .heading { padding: .125rem 1.25rem 1rem; }
    .heading > p, .exercise-list h2 { margin: 0; color: #c9f24b; font-family: 'JetBrains Mono', monospace; font-size: .625rem; letter-spacing: .12em; }
    .heading h1 { margin: .5rem 0 0; font-family: 'Unbounded', sans-serif; font-size: 1.625rem; font-weight: 600; letter-spacing: -.04em; line-height: 1.12; }
    .meta { display: flex; gap: .875rem; margin-top: .5rem; color: #8a94a6; font-size: .8125rem; }
    .description { margin-top: .75rem; color: #b7bfcb; font-size: .875rem; line-height: 1.5; }
    .execution-card { display: flex; flex-direction: column; gap: .25rem; margin: 0 1.25rem 1rem; padding: 1rem; border: 1px solid rgb(201 242 75 / 16%); border-radius: .875rem; background: #1c222b; }
    .execution-card strong { color: #f5f7fa; font-size: .9375rem; }
    .execution-card small { color: #8a94a6; font-size: .75rem; line-height: 1.45; }
    .exercise-list { display: flex; flex-direction: column; gap: .625rem; padding: 0 1.25rem 1rem; }
    .exercise-list h2 { margin: .375rem 0 .0625rem; color: #8a94a6; }
    .exercise { display: flex; align-items: flex-start; gap: .8125rem; min-height: 4.25rem; padding: .75rem .875rem; border-radius: .875rem; background: #1c222b; }
    .exercise-media { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; border-radius: .6875rem; object-fit: cover; }
    .exercise-media--placeholder { display: grid; place-items: center; background: #242b34; color: #8a94a6; font-family: 'JetBrains Mono', monospace; font-size: .6875rem; }
    .exercise-copy { min-width: 0; flex: 1; }
    .exercise-copy strong { display: block; font-size: .9375rem; font-weight: 600; }
    .chips { display: flex; gap: .375rem; margin-top: .25rem; font-family: 'JetBrains Mono', monospace; font-size: .6875rem; }
    .chips i { border-radius: .375rem; padding: .1875rem .5rem; background: #14181d; color: #f5f7fa; font-style: normal; }
    .chips .chip--lime { color: #c9f24b; }
    .instruction { display: block; margin-top: .5rem; color: #8a94a6; font-size: .75rem; line-height: 1.45; }
    .action-bar { position: fixed; right: 0; bottom: calc(3.75rem + env(safe-area-inset-bottom)); left: 0; padding: .875rem 1.25rem; border-top: 1px solid rgb(245 247 250 / 6%); background: #14181d; }
    .cta { width: 100%; height: 3.5rem; border: 0; border-radius: .8125rem; background: #c9f24b; color: #14181d; font-size: 1rem; font-weight: 700; cursor: pointer; }
    .cta:disabled { opacity: .55; cursor: default; }
    .tabbar { position: fixed; z-index: 2; inset-inline: 0; bottom: 0; display: flex; justify-content: space-around; padding: .75rem 1.25rem calc(.75rem + env(safe-area-inset-bottom)); border-top: 1px solid rgb(245 247 250 / 6%); background: #14181d; }
    .tab { color: #5b6472; font-size: .625rem; text-decoration: none; }.tab.is-active { color: #c9f24b; font-weight: 600; }
    @media (min-width: 720px) { .screen { max-width: 30rem; margin: 0 auto; } .action-bar,.tabbar { width: 30rem; right: auto; left: 50%; transform: translateX(-50%); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutPlayerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly assignmentsApi = inject(WorkoutAssignmentsApi);
  private readonly executionsApi = inject(WorkoutExecutionsApi);

  protected readonly plan = signal<WorkoutExecutionPlan | null>(null);
  protected readonly execution = signal<WorkoutExecutionResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly mutating = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly lifecycleAction = computed(() => {
    const item = this.plan();
    if (!item) return 'none';
    return executionActionForResponse(item.assignmentStatus, this.execution());
  });
  protected readonly executionStatusLabel = computed(() => {
    const current = this.execution();
    if (current) return current.status === 'COMPLETED' ? 'ЗАВЕРШЕНА' : 'В ПРОЦЕССЕ';
    return this.plan()?.assignmentStatus === 'CANCELLED' ? 'ОТМЕНЕНА' : 'НЕ НАЧАТА';
  });
  protected readonly terminalActionLabel = computed(() =>
    this.plan()?.assignmentStatus === 'CANCELLED' && !this.execution()
      ? 'Тренировка отменена'
      : 'Тренировка завершена',
  );

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
      next: (assignment) => {
        this.plan.set(toWorkoutExecutionPlan(assignment));
        this.loadExecution(assignmentId);
      },
      error: (error: unknown) => {
        this.errorMessage.set(clientAssignmentReadErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected detailsParams(assignmentId: string): { assignment_id: string } {
    return clientAssignmentDetailsQueryParams(assignmentId);
  }

  protected exerciseCount(plan: WorkoutExecutionPlan): number {
    return plan.blocks.reduce((total, block) => total + block.exercises.length, 0);
  }

  protected startExecution(): void {
    const assignmentId = this.plan()?.assignmentId;
    if (!assignmentId || this.mutating() || this.lifecycleAction() !== 'start') return;
    this.runMutation(this.executionsApi.start(assignmentId));
  }

  protected completeExecution(): void {
    const assignmentId = this.plan()?.assignmentId;
    if (!assignmentId || this.mutating() || this.lifecycleAction() !== 'complete') return;
    this.runMutation(this.executionsApi.complete(assignmentId));
  }

  private loadExecution(assignmentId: string): void {
    this.executionsApi.get(assignmentId).subscribe({
      next: (execution) => this.execution.set(execution),
      error: (error: unknown) => {
        if (isWorkoutExecutionNotFound(error)) {
          this.execution.set(null);
        } else {
          this.errorMessage.set('Не удалось загрузить состояние выполнения тренировки.');
        }
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private runMutation(request: import('rxjs').Observable<WorkoutExecutionResponse>): void {
    this.mutating.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (execution) => this.execution.set(execution),
      error: () => {
        this.errorMessage.set('Не удалось обновить состояние тренировки. Повторите действие.');
        this.mutating.set(false);
      },
      complete: () => this.mutating.set(false),
    });
  }
}
