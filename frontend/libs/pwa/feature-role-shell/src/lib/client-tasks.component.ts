import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type TaskKind = 'weight' | 'photo' | 'measure' | 'sleep' | 'water';
type TaskState = 'active' | 'done' | 'pending';

interface ClientTask {
  id: string;
  kind: TaskKind;
  title: string;
  hint: string;
  state: TaskState;
  dayLabel: string; // e.g. 'СЕГОДНЯ · ДО ЗАВТРАКА' | 'ВЫПОЛНЕНО · ПН' | 'ЧТ'
  unit?: string; // for weight input
  value?: string;
}

const TASKS: readonly ClientTask[] = [
  { id: 'weigh', kind: 'weight', title: 'Взвеситься', hint: 'Утром, натощак, до воды. Внеси вес — построим график тренда.', state: 'active', dayLabel: 'СЕГОДНЯ · ДО ЗАВТРАКА', unit: 'КГ', value: '82,4' },
  { id: 'photo', kind: 'photo', title: 'Фото-прогресс', hint: 'Три кадра: спереди, сбоку, сзади.', state: 'done', dayLabel: 'ВЫПОЛНЕНО · ПН' },
  { id: 'water', kind: 'water', title: 'Вода 2,5 л', hint: 'Отмечай стаканы в течение дня.', state: 'done', dayLabel: 'ВЫПОЛНЕНО · ВТ' },
  { id: 'measure', kind: 'measure', title: 'Замеры талии и бедра', hint: 'Сантиметром, без втягивания живота', state: 'pending', dayLabel: 'ЧТ' },
  { id: 'sleep', kind: 'sleep', title: 'Дневник сна', hint: 'Часы сна + самочувствие 1–5', state: 'pending', dayLabel: 'ВС' },
];

@Component({
  selector: 'tt-client-tasks',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <div class="head">
        <div class="title-row">
          <h1>Задачи</h1>
          <span class="week">НЕДЕЛЯ 2</span>
        </div>
        <div class="progress">
          <span class="bar"><i [style.width.%]="progressPct()"></i></span>
          <span class="progress-label">{{ doneCount() }} / {{ tasks().length }}</span>
        </div>

        <div class="task-list">
          @for (task of tasks(); track task.id) {
            @if (task.state === 'active') {
              <div class="task task--active">
                <div class="task-top">
                  <span class="task-icon" [attr.data-kind]="task.kind">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7" /></svg>
                  </span>
                  <span class="task-body">
                    <strong>{{ task.title }}</strong>
                    <span class="task-day task-day--lime">{{ task.dayLabel }}</span>
                  </span>
                </div>
                <p class="task-hint">{{ task.hint }}</p>
                <div class="task-input-row">
                  <div class="weight-field">
                    <span class="weight-value">{{ task.value }}</span>
                    <span class="weight-unit">{{ task.unit }}</span>
                  </div>
                  <button type="button" class="mark" (click)="complete(task.id)">Отметить</button>
                </div>
              </div>
            } @else if (task.state === 'done') {
              <div class="task task--done">
                <span class="check check--done"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14181d" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10" /></svg></span>
                <span class="task-body">
                  <strong class="struck">{{ task.title }}</strong>
                  <span class="task-day">{{ task.dayLabel }}</span>
                </span>
              </div>
            } @else {
              <button type="button" class="task task--pending" (click)="complete(task.id)">
                <span class="check check--empty"></span>
                <span class="task-body">
                  <strong>{{ task.title }}</strong>
                  <span class="task-hint task-hint--inline">{{ task.hint }}</span>
                </span>
                <span class="task-day-tag">{{ task.dayLabel }}</span>
              </button>
            }
          }
        </div>
      </div>

      <nav class="tabbar" aria-label="Навигация">
        <a class="tab" routerLink="/client">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
          <span>Сегодня</span>
        </a>
        <a class="tab is-active" routerLink="/client/tasks">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>
          <span>Календарь</span>
        </a>
        <a class="tab" routerLink="/client/history">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>
          <span>Прогресс</span>
        </a>
        <a class="tab" href="#competitions">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg>
          <span>Соревн.</span>
        </a>
        <a class="tab" href="#profile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          <span>Профиль</span>
        </a>
      </nav>
    </div>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; padding-bottom: 5rem; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .head { padding: 1.25rem 1.375rem 1.5rem; }
    .title-row { display: flex; align-items: center; justify-content: space-between; }
    .title-row h1 { margin: 0; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.625rem; letter-spacing: -0.025em; color: #f5f7fa; }
    .week { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
    .progress { display: flex; align-items: center; gap: 0.625rem; margin-top: 0.875rem; }
    .bar { flex: 1; height: 0.5rem; border-radius: 999px; background: rgb(245 247 250 / 9%); overflow: hidden; }
    .bar i { display: block; height: 100%; background: #c9f24b; border-radius: 999px; }
    .progress-label { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #c9f24b; }
    .task-list { display: flex; flex-direction: column; gap: 0.625rem; margin-top: 1.25rem; }
    .task { background: #1c222b; border-radius: 1rem; padding: 1rem; width: 100%; text-align: left; border: 0; color: inherit; font: inherit; }
    .task--active { border: 1px solid #c9f24b; }
    .task--pending { display: flex; align-items: center; gap: 0.6875rem; cursor: pointer; }
    .task--done { display: flex; align-items: center; gap: 0.6875rem; padding: 0.9375rem 1rem; }
    .task-top { display: flex; align-items: center; gap: 0.6875rem; }
    .task-icon { display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 0.625rem; flex: none; color: #e7b54a; background: rgb(231 181 74 / 16%); }
    .task-icon[data-kind='photo'] { color: #2f5cff; background: rgb(47 92 255 / 16%); }
    .task-icon[data-kind='measure'] { color: #c9f24b; background: rgb(201 242 75 / 14%); }
    .task-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1875rem; }
    .task-body strong { font-weight: 600; font-size: 1rem; color: #f5f7fa; }
    .task-body strong.struck { color: #8a94a6; text-decoration: line-through; }
    .task-day { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #5b6472; }
    .task-day--lime { color: #c9f24b; }
    .task-day-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .task-hint { margin: 0.75rem 0 0; font-size: 0.8125rem; line-height: 1.5; color: #8a94a6; }
    .task-hint--inline { margin: 0; font-weight: 400; font-size: 0.75rem; }
    .task-input-row { display: flex; align-items: center; gap: 0.625rem; margin-top: 0.875rem; }
    .weight-field { flex: 1; display: flex; align-items: center; gap: 0.5rem; height: 3.125rem; padding: 0 0.875rem; background: #14181d; border-radius: 0.75rem; }
    .weight-value { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.25rem; color: #f5f7fa; }
    .weight-unit { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
    .mark { display: flex; align-items: center; justify-content: center; height: 3.125rem; padding: 0 1.25rem; border: 0; border-radius: 0.75rem; background: #c9f24b; color: #14181d; font: inherit; font-weight: 700; font-size: 0.9375rem; cursor: pointer; }
    .check { width: 1.625rem; height: 1.625rem; border-radius: 999px; flex: none; display: flex; align-items: center; justify-content: center; }
    .check--done { background: #c9f24b; }
    .check--empty { border: 2px solid rgb(245 247 250 / 18%); }
    .tabbar { position: fixed; inset-inline: 0; bottom: 0; display: flex; justify-content: space-around; padding: 0.75rem 0.625rem calc(0.75rem + env(safe-area-inset-bottom)); background: #14181d; border-top: 1px solid rgb(245 247 250 / 6%); }
    .tab { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; color: #8a94a6; text-decoration: none; font-size: 0.5625rem; }
    .tab.is-active { color: #c9f24b; font-weight: 600; }
    @media (min-width: 720px) { .screen { max-width: 30rem; margin: 0 auto; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientTasksComponent {
  protected readonly tasks = signal<ClientTask[]>([...TASKS]);
  protected readonly doneCount = computed(() => this.tasks().filter((t) => t.state === 'done').length);
  protected readonly progressPct = computed(() => Math.round((this.doneCount() / this.tasks().length) * 100));

  protected complete(id: string): void {
    this.tasks.update((items) =>
      items.map((t) => (t.id === id ? { ...t, state: 'done', dayLabel: 'ВЫПОЛНЕНО · СЕГОДНЯ' } : t)),
    );
  }
}
