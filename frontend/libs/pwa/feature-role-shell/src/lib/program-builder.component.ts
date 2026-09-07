import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import { apiUrl, ProgramsApi } from '@toptrainers/shared/data-access';
import type { ProgramResponse, WorkoutResponse } from '@toptrainers/shared/contracts';

import {
  createProgramDraft,
  programDraftPayload,
  setProgramDraftDuration,
  setProgramDraftSlot,
  type ProgramDraft,
} from './program-builder-state';

const DAY_LABELS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

@Component({
  selector: 'tt-program-builder',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="workspace">
      <header class="toolbar">
        <div>
          <a class="back" routerLink="/trainer">← Сегодня</a>
          <h1>Программы</h1>
        </div>
        <a class="outline" routerLink="/trainer/programs/library">Упражнения и тренировки</a>
      </header>
      @if (message()) {
        <p class="message" [class.is-error]="isError()">{{ message() }}</p>
      }
      @if (loading()) {
        <p class="state">Загружаем программы, тренировки и клиентов…</p>
      } @else {
        <div class="layout">
          <aside class="panel program-list">
            <div class="panel-head">
              <h2>Ваши программы</h2>
              <button type="button" class="outline" (click)="newProgram()">Новая</button>
            </div>
            @if (!programs().length) {
              <p class="state">Сохранённых программ пока нет.</p>
            } @else {
              @for (program of programs(); track program.id) {
                <button
                  type="button"
                  class="program-card"
                  [class.is-active]="draft().id === program.id"
                  (click)="selectProgram(program)"
                >
                  <b>{{ program.title }}</b
                  ><span>{{ program.duration_weeks }} нед. · {{ program.slots.length }} трен.</span>
                </button>
              }
            }
          </aside>
          <section class="panel editor">
            <div class="panel-head">
              <h2>{{ draft().id ? 'Редактирование программы' : 'Новая программа' }}</h2>
              <button type="button" class="primary" (click)="save()" [disabled]="saving()">
                {{ saving() ? 'Сохраняем…' : 'Сохранить' }}
              </button>
            </div>
            <label
              >Название *<input
                name="title"
                [(ngModel)]="draftTitle"
                maxlength="160"
                required
                placeholder="Например, Гипертрофия"
            /></label>
            <label
              >Описание<textarea
                name="description"
                [(ngModel)]="draftDescription"
                maxlength="2000"
                placeholder="Цель и особенности программы"
              ></textarea>
            </label>
            <label
              >Длительность, недель<input
                name="duration"
                type="number"
                min="1"
                max="52"
                [ngModel]="draft().durationWeeks"
                (ngModelChange)="changeDuration($event)"
            /></label>
            <section class="schedule" aria-label="Расписание программы">
              <div class="week-tabs" role="tablist" aria-label="Недели программы">
                @for (week of weekNumbers(); track week) {
                  <button
                    type="button"
                    [class.is-active]="selectedWeek() === week"
                    (click)="selectedWeek.set(week)"
                  >
                    Нед. {{ week }}
                  </button>
                }
              </div>
              @for (day of dayLabels; track day; let dayIndex = $index) {
                <label class="day-row"
                  ><span>{{ day }}</span
                  ><select
                    [ngModel]="slotWorkoutId(dayIndex + 1)"
                    [name]="'day-' + (dayIndex + 1)"
                    (ngModelChange)="changeSlot(dayIndex + 1, $event)"
                  >
                    <option value="">Без тренировки</option>
                    @for (workout of workouts(); track workout.id) {
                      <option [value]="workout.id">{{ workout.title }}</option>
                    }
                  </select></label
                >
              }
            </section>
          </section>
          <aside class="panel issue-panel">
            <h2>Назначить клиенту</h2>
            @if (!draft().id) {
              <p class="state">Сначала сохраните программу.</p>
            } @else if (!canIssueCurrentProgram()) {
              <p class="state">Добавьте хотя бы одну тренировку в расписание.</p>
            } @else if (!relationships().length) {
              <p class="state">Нет активных клиентов для назначения.</p>
            } @else {
              <label
                >Клиент<select name="client" [(ngModel)]="selectedClientId">
                  <option value="">Выберите ID клиента</option>
                  @for (relationship of relationships(); track relationship.id) {
                    <option [value]="relationship.client_id">{{ relationship.client_id }}</option>
                  }
                </select></label
              >
              <label
                >Дата старта<input name="startDate" [(ngModel)]="startDate" type="date" required
              /></label>
              <button type="button" class="primary" (click)="issue()" [disabled]="issuing()">
                {{ issuing() ? 'Назначаем…' : 'Назначить программу' }}
              </button>
            }
          </aside>
        </div>
      }
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
    .workspace {
      min-height: 100dvh;
      box-sizing: border-box;
      padding: clamp(1rem, 3vw, 2rem);
      background: #14181d;
      color: #f5f7fa;
      font-family: 'Golos Text', system-ui, sans-serif;
    }
    .toolbar,
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .toolbar {
      border-bottom: 1px solid rgb(245 247 250 / 8%);
      padding-bottom: 1rem;
    }
    .back {
      color: #9aa6b8;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .toolbar h1,
    .panel h2 {
      margin: 0.35rem 0 0;
      font-family: 'Unbounded', sans-serif;
    }
    .toolbar h1 {
      font-size: clamp(1.5rem, 3vw, 2.25rem);
    }
    .panel h2 {
      font-size: 1rem;
    }
    .layout {
      display: grid;
      gap: 1rem;
      margin-top: 1rem;
    }
    .panel {
      display: grid;
      align-content: start;
      gap: 0.875rem;
      padding: 1rem;
      border: 1px solid rgb(245 247 250 / 9%);
      border-radius: 1rem;
      background: #1c222b;
    }
    .program-list {
      grid-area: list;
    }
    .editor {
      grid-area: editor;
    }
    .issue-panel {
      grid-area: issue;
    }
    .program-card {
      display: grid;
      gap: 0.3rem;
      width: 100%;
      padding: 0.85rem;
      border: 1px solid transparent;
      border-radius: 0.7rem;
      background: #171c22;
      color: #f5f7fa;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .program-card.is-active {
      border-color: #c9f24b;
    }
    .program-card span,
    .state {
      color: #9aa6b8;
      font-size: 0.85rem;
      line-height: 1.45;
    }
    .state {
      margin: 0;
    }
    .outline,
    .primary,
    .week-tabs button {
      border-radius: 0.6rem;
      padding: 0.6rem 0.8rem;
      font: inherit;
      cursor: pointer;
    }
    .outline,
    .week-tabs button {
      border: 1px solid rgb(245 247 250 / 16%);
      background: transparent;
      color: #f5f7fa;
      text-decoration: none;
    }
    .primary {
      border: 0;
      background: #c9f24b;
      color: #14181d;
      font-weight: 700;
    }
    .primary:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    .message {
      margin: 1rem 0;
      padding: 0.75rem 1rem;
      border-radius: 0.6rem;
      background: rgb(201 242 75 / 12%);
      color: #d9fb76;
    }
    .message.is-error {
      background: rgb(255 115 115 / 12%);
      color: #ffabab;
    }
    label {
      display: grid;
      gap: 0.35rem;
      color: #b9c2d0;
      font-size: 0.85rem;
      font-weight: 600;
    }
    input,
    textarea,
    select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgb(245 247 250 / 13%);
      border-radius: 0.55rem;
      background: #14181d;
      color: #f5f7fa;
      padding: 0.7rem 0.8rem;
      font: inherit;
      font-weight: 400;
    }
    textarea {
      min-height: 5.5rem;
      resize: vertical;
    }
    .schedule {
      display: grid;
      gap: 0.65rem;
      margin-top: 0.5rem;
    }
    .week-tabs {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .week-tabs button.is-active {
      border-color: #c9f24b;
      color: #c9f24b;
    }
    .day-row {
      grid-template-columns: minmax(7rem, 0.75fr) minmax(0, 1.5fr);
      align-items: center;
    }
    .day-row span {
      color: #f5f7fa;
    }
    @media (min-width: 1080px) {
      .layout {
        grid-template-columns: minmax(14rem, 0.75fr) minmax(28rem, 1.6fr) minmax(16rem, 0.8fr);
        grid-template-areas: 'list editor issue';
      }
      .program-list {
        max-height: calc(100dvh - 9rem);
        overflow: auto;
      }
    }
    @media (max-width: 1079.98px) {
      .layout {
        grid-template-columns: 1fr;
        grid-template-areas: 'editor' 'issue' 'list';
      }
      .workspace {
        padding-bottom: calc(5rem + env(safe-area-inset-bottom));
      }
    }
    @media (max-width: 30rem) {
      .toolbar,
      .panel-head {
        flex-direction: column;
        align-items: stretch;
      }
      .day-row {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramBuilderComponent {
  private readonly api = inject(ProgramsApi);
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);
  protected readonly dayLabels = DAY_LABELS;
  protected readonly programs = signal<ProgramResponse[]>([]);
  protected readonly workouts = signal<WorkoutResponse[]>([]);
  protected readonly relationships = signal<Array<{ id: string; client_id: string }>>([]);
  protected readonly draft = signal<ProgramDraft>(createProgramDraft());
  protected readonly selectedWeek = signal(1);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly issuing = signal(false);
  protected readonly message = signal('');
  protected readonly isError = signal(false);
  protected readonly weekNumbers = computed(() =>
    Array.from({ length: this.draft().durationWeeks }, (_, index) => index + 1),
  );
  protected draftTitle = '';
  protected draftDescription = '';
  protected selectedClientId = '';
  protected startDate = '';
  constructor() {
    this.load();
  }
  protected newProgram(): void {
    this.setDraft(createProgramDraft());
  }
  protected selectProgram(program: ProgramResponse): void {
    this.setDraft({
      id: program.id,
      title: program.title,
      description: program.description ?? '',
      durationWeeks: program.duration_weeks ?? 1,
      slots: program.slots.map(({ week_number, day_number, workout_id }) => ({
        week_number,
        day_number,
        workout_id,
      })),
    });
  }
  protected changeDuration(value: string | number): void {
    const duration = Math.max(1, Math.min(52, Number(value) || 1));
    this.draft.update((draft) => setProgramDraftDuration(draft, duration));
    if (this.selectedWeek() > duration) this.selectedWeek.set(duration);
  }
  protected slotWorkoutId(dayNumber: number): string {
    return (
      this.draft().slots.find(
        (slot) => slot.week_number === this.selectedWeek() && slot.day_number === dayNumber,
      )?.workout_id ?? ''
    );
  }
  protected changeSlot(dayNumber: number, workoutId: string): void {
    this.draft.update((draft) =>
      setProgramDraftSlot(draft, this.selectedWeek(), dayNumber, workoutId || null),
    );
  }
  protected canIssueCurrentProgram(): boolean {
    return this.draft().slots.length > 0;
  }
  protected save(): void {
    this.draft.update((draft) => ({
      ...draft,
      title: this.draftTitle,
      description: this.draftDescription,
    }));
    const payload = programDraftPayload(this.draft());
    if (!payload.title) {
      this.showMessage('Введите название программы.', true);
      return;
    }
    const programId = this.draft().id;
    this.saving.set(true);
    this.clearMessage();
    const request = programId ? this.api.replace(programId, payload) : this.api.create(payload);
    request.subscribe({
      next: (program) => {
        this.programs.update((items) => [
          ...items.filter((item) => item.id !== program.id),
          program,
        ]);
        this.selectProgram(program);
        this.showMessage('Программа сохранена.');
      },
      error: (error) => this.showMessage(this.errorMessage(error), true),
      complete: () => this.saving.set(false),
    });
  }
  protected issue(): void {
    const programId = this.draft().id;
    if (!programId || !this.selectedClientId || !this.startDate) {
      this.showMessage('Выберите клиента и дату старта.', true);
      return;
    }
    if (!this.canIssueCurrentProgram()) {
      this.showMessage('Пустую программу назначить нельзя.', true);
      return;
    }
    this.issuing.set(true);
    this.clearMessage();
    this.api
      .issue(programId, {
        client_id: this.selectedClientId,
        start_date: this.startDate,
        request_id: crypto.randomUUID(),
      })
      .subscribe({
        next: () => this.showMessage('Программа назначена. Даты тренировок определены сервером.'),
        error: (error) => this.showMessage(this.errorMessage(error), true),
        complete: () => this.issuing.set(false),
      });
  }
  private load(): void {
    forkJoin({
      programs: this.api.list(),
      relationships: this.api.listActiveRelationships(),
      workouts: this.http.get<WorkoutResponse[]>(apiUrl(this.config, '/workouts')),
    }).subscribe({
      next: ({ programs, relationships, workouts }) => {
        this.programs.set(programs);
        this.relationships.set(relationships.map(({ id, client_id }) => ({ id, client_id })));
        this.workouts.set(workouts);
      },
      error: (error) => this.showMessage(this.errorMessage(error), true),
      complete: () => this.loading.set(false),
    });
  }
  private setDraft(draft: ProgramDraft): void {
    this.draft.set(draft);
    this.draftTitle = draft.title;
    this.draftDescription = draft.description;
    this.selectedWeek.set(1);
    this.clearMessage();
  }
  private clearMessage(): void {
    this.message.set('');
    this.isError.set(false);
  }
  private showMessage(value: string, error = false): void {
    this.message.set(value);
    this.isError.set(error);
  }
  private errorMessage(error: { error?: { detail?: string } }): string {
    return error.error?.detail || 'Не удалось сохранить данные. Повторите попытку.';
  }
}
