import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { WorkoutHistoryItem } from '@toptrainers/shared/contracts';
import { WorkoutHistoryApi } from '@toptrainers/shared/data-access';

import {
  appendWorkoutHistoryPage,
  historyAssignmentQueryParams,
  isWorkoutHistoryEmpty,
} from './workout-history-view';

@Component({
  selector: 'tt-client-workout-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <main class="screen">
      <header class="app-header">
        <a class="back" routerLink="/client" aria-label="Вернуться на Сегодня">‹ Сегодня</a>
        <h1>История тренировок</h1>
      </header>

      @if (initialLoading()) {
        <section class="state" aria-live="polite">Загружаем историю…</section>
      } @else if (isEmpty()) {
        <section class="state">
          <strong>Завершённых тренировок пока нет</strong>
          <span>Здесь появятся тренировки после завершения.</span>
        </section>
      } @else {
        <section class="history-list" aria-label="Завершённые тренировки">
          @for (item of items(); track item.assignment_id) {
            <a
              class="history-item"
              routerLink="/client/workout"
              [queryParams]="assignmentParams(item)"
            >
              <span class="copy">
                <strong>{{ item.workout_title }}</strong>
                <small>Назначена {{ item.scheduled_date }}</small>
              </span>
              <span class="completed">
                {{ item.completed_at | date:'dd.MM.yyyy, HH:mm' }}
                <i>›</i>
              </span>
            </a>
          }
        </section>
      }

      @if (errorMessage()) {
        <p class="error" role="alert">{{ errorMessage() }}</p>
      }

      @if (nextCursor()) {
        <button type="button" class="load-more" [disabled]="loadingMore()" (click)="loadMore()">
          {{ loadingMore() ? 'Загружаем…' : 'Показать ещё' }}
        </button>
      }

      <nav class="tabbar" aria-label="Навигация клиента">
        <a class="tab" routerLink="/client">Сегодня</a>
        <a class="tab is-active" routerLink="/client/history" aria-current="page">История</a>
      </nav>
    </main>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; padding: 0 1.25rem calc(5rem + env(safe-area-inset-bottom)); background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .app-header { padding: 1rem 0 1.125rem; }
    .back { color: #8a94a6; font-size: .8125rem; text-decoration: none; }
    h1 { margin: .625rem 0 0; font-family: 'Unbounded', sans-serif; font-size: 1.5rem; letter-spacing: -.04em; }
    .state { display: flex; flex-direction: column; gap: .375rem; padding: 1rem; border-radius: .875rem; background: #1c222b; color: #8a94a6; line-height: 1.45; }
    .state strong { color: #f5f7fa; }
    .history-list { display: flex; flex-direction: column; gap: .625rem; }
    .history-item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .875rem 1rem; border-radius: .875rem; background: #1c222b; color: inherit; text-decoration: none; }
    .copy { min-width: 0; display: flex; flex-direction: column; gap: .25rem; }
    .copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .9375rem; }
    .copy small, .completed { color: #8a94a6; font-size: .75rem; }
    .completed { flex: 0 0 auto; display: flex; align-items: center; gap: .5rem; }
    .completed i { color: #c9f24b; font-size: 1.25rem; font-style: normal; }
    .error { margin: .75rem 0 0; color: #ff9ba5; font-size: .8125rem; }
    .load-more { width: 100%; height: 3rem; margin-top: 1rem; border: 1px solid rgb(201 242 75 / 28%); border-radius: .75rem; background: transparent; color: #c9f24b; font-weight: 700; cursor: pointer; }
    .load-more:disabled { opacity: .55; cursor: default; }
    .tabbar { position: fixed; inset-inline: 0; bottom: 0; display: flex; justify-content: space-around; padding: .875rem 1.25rem calc(.875rem + env(safe-area-inset-bottom)); border-top: 1px solid rgb(245 247 250 / 6%); background: #14181d; }
    .tab { color: #5b6472; font-size: .75rem; text-decoration: none; }.tab.is-active { color: #c9f24b; font-weight: 700; }
    @media (min-width: 720px) { .screen { max-width: 30rem; margin: 0 auto; } .tabbar { width: 30rem; right: auto; left: 50%; transform: translateX(-50%); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkoutHistoryComponent {
  private readonly historyApi = inject(WorkoutHistoryApi);

  protected readonly items = signal<WorkoutHistoryItem[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly initialLoading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isEmpty = computed(() => isWorkoutHistoryEmpty(this.items(), this.initialLoading()));

  constructor() {
    this.loadPage();
  }

  protected assignmentParams(item: WorkoutHistoryItem): { assignment_id: string } {
    return historyAssignmentQueryParams(item);
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    this.loadPage(cursor);
  }

  private loadPage(cursor?: string): void {
    const isMore = Boolean(cursor);
    if (isMore) this.loadingMore.set(true);
    this.errorMessage.set('');

    this.historyApi.listClient(cursor).subscribe({
      next: (page) => {
        const result = appendWorkoutHistoryPage(isMore ? this.items() : [], page);
        this.items.set(result.items);
        this.nextCursor.set(result.nextCursor);
      },
      error: () => {
        this.errorMessage.set(
          isMore
            ? 'Не удалось загрузить следующую страницу. Уже загруженная история сохранена.'
            : 'Не удалось загрузить историю тренировок.',
        );
        this.initialLoading.set(false);
        this.loadingMore.set(false);
      },
      complete: () => {
        this.initialLoading.set(false);
        this.loadingMore.set(false);
      },
    });
  }
}
