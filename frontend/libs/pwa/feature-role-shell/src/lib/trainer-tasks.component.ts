import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

type TaskKind = 'weight' | 'photo' | 'measure' | 'sleep' | 'water';

interface TrainerTask {
  id: string;
  kind: TaskKind;
  title: string;
  description: string;
  usedIn: number;
}

const TASKS: readonly TrainerTask[] = [
  { id: 'weigh', kind: 'weight', title: 'Взвеситься', description: 'Утром, натощак, до воды. Внеси вес в приложение — построим график и увидим тренд за неделю.', usedIn: 6 },
  { id: 'photo', kind: 'photo', title: 'Фото-прогресс', description: 'Три кадра: спереди, сбоку, сзади. Тот же свет и то же место.', usedIn: 4 },
  { id: 'measure', kind: 'measure', title: 'Замеры талии и бедра', description: 'Сантиметром по самой узкой точке, без втягивания живота.', usedIn: 3 },
  { id: 'sleep', kind: 'sleep', title: 'Дневник сна', description: 'Отметь часы сна и самочувствие по шкале 1–5.', usedIn: 2 },
  { id: 'water', kind: 'water', title: 'Вода 2,5 л', description: 'Отмечай стаканы в течение дня — важно в дни тяжёлых тренировок.', usedIn: 5 },
];

@Component({
  selector: 'tt-trainer-tasks',
  standalone: true,
  template: `
    <div class="tasks">
      <div class="list">
        <div class="list-head">
          <span class="list-title">Задачи</span>
          <button type="button" class="add" (click)="newTask()">＋ Задача</button>
        </div>
        <div class="list-body">
          @for (task of tasks(); track task.id) {
            <button type="button" class="task-row" [class.is-active]="task.id === selectedId()" (click)="select(task.id)">
              <span class="task-icon" [attr.data-kind]="task.kind">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7" /></svg>
              </span>
              <span class="task-text">
                <span class="task-name">{{ task.title }}</span>
                <span class="task-desc">{{ task.description }}</span>
              </span>
              <span class="task-count">В {{ task.usedIn }} ПРОГР.</span>
            </button>
          }
          <button type="button" class="add-dashed" (click)="newTask()">＋ Новая задача</button>
        </div>
      </div>

      <div class="editor">
        @if (selectedTask(); as task) {
          <div class="editor-head">
            <span class="editor-kicker">ЗАДАЧА</span>
            <span class="close">✕</span>
          </div>
          <div class="field">
            <div class="label">НАЗВАНИЕ</div>
            <div class="value value--name">{{ task.title }}</div>
          </div>
          <div class="field">
            <div class="label-row">
              <span class="label">ОПИСАНИЕ · ВИДИТ КЛИЕНТ</span>
              <span class="counter">{{ task.description.length }} / 300</span>
            </div>
            <div class="value value--desc">{{ task.description }}</div>
          </div>
          <div class="note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>
            <span>Задача — сущность без упражнений. Дни и повторяемость задаются в расписании программы.</span>
          </div>
          <button type="button" class="save" (click)="save()">Сохранить задачу</button>
        }
      </div>

      @if (message()) {
        <p class="message">{{ message() }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .tasks { position: relative; max-width: 61.25rem; margin: 0 auto; display: flex; background: #14181d; color: #f5f7fa; border-radius: 1.125rem; overflow: hidden; box-shadow: 0 30px 90px rgb(20 24 29 / 30%); font-family: 'Golos Text', system-ui, sans-serif; }
    .list { flex: 1; min-width: 0; border-right: 1px solid rgb(245 247 250 / 6%); }
    .list-head { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.375rem; border-bottom: 1px solid rgb(245 247 250 / 6%); }
    .list-title { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.125rem; color: #f5f7fa; }
    .add { display: flex; align-items: center; gap: 0.4375rem; border: 0; font: inherit; font-size: 0.8125rem; font-weight: 700; color: #14181d; background: #c9f24b; padding: 0.5625rem 0.875rem; border-radius: 0.5625rem; cursor: pointer; }
    .list-body { padding: 0.875rem 1.125rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .task-row { display: flex; gap: 0.75rem; align-items: flex-start; background: #1c222b; border: 1px solid transparent; border-radius: 0.8125rem; padding: 0.875rem 0.9375rem; text-align: left; cursor: pointer; color: inherit; font: inherit; }
    .task-row.is-active { border-color: #c9f24b; }
    .task-icon { display: flex; align-items: center; justify-content: center; width: 1.875rem; height: 1.875rem; border-radius: 0.5625rem; flex: none; color: #e7b54a; background: rgb(231 181 74 / 16%); }
    .task-icon[data-kind='photo'] { color: #2f5cff; background: rgb(47 92 255 / 16%); }
    .task-icon[data-kind='measure'] { color: #c9f24b; background: rgb(201 242 75 / 14%); }
    .task-icon[data-kind='sleep'], .task-icon[data-kind='water'] { color: #8a94a6; background: rgb(245 247 250 / 8%); }
    .task-text { flex: 1; min-width: 0; }
    .task-name { display: block; font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
    .task-desc { display: block; font-size: 0.75rem; line-height: 1.45; color: #8a94a6; margin-top: 0.25rem; }
    .task-count { font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #8a94a6; white-space: nowrap; }
    .add-dashed { display: flex; align-items: center; justify-content: center; gap: 0.4375rem; padding: 0.8125rem; border: 1.5px dashed rgb(245 247 250 / 18%); border-radius: 0.8125rem; background: transparent; color: #8a94a6; font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
    .editor { width: 22.5rem; flex: none; padding: 1.375rem; display: flex; flex-direction: column; gap: 1.125rem; }
    .editor-head { display: flex; align-items: center; justify-content: space-between; }
    .editor-kicker { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #f5f7fa; font-weight: 700; }
    .close { color: #8a94a6; }
    .label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; margin-bottom: 0.4375rem; }
    .label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4375rem; }
    .label-row .label { margin: 0; }
    .counter { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #5b6472; }
    .value { background: #1c222b; border: 1px solid rgb(245 247 250 / 10%); border-radius: 0.6875rem; padding: 0.8125rem 0.875rem; color: #f5f7fa; }
    .value--name { font-size: 0.9375rem; font-weight: 600; }
    .value--desc { font-size: 0.875rem; line-height: 1.5; min-height: 7rem; }
    .note { display: flex; align-items: flex-start; gap: 0.5625rem; padding: 0.75rem 0.8125rem; background: rgb(47 92 255 / 10%); border-radius: 0.6875rem; }
    .note svg { flex: none; margin-top: 0.0625rem; }
    .note span { font-size: 0.75rem; line-height: 1.45; color: #8a94a6; }
    .save { margin-top: auto; display: flex; align-items: center; justify-content: center; height: 3rem; border: 0; border-radius: 0.6875rem; background: #c9f24b; color: #14181d; font: inherit; font-weight: 700; font-size: 0.9375rem; cursor: pointer; }
    .message { position: absolute; left: 1.375rem; bottom: 0.5rem; font-size: 0.75rem; color: #8a94a6; }
    @media (max-width: 860px) {
      .tasks { flex-direction: column; }
      .list { border-right: 0; border-bottom: 1px solid rgb(245 247 250 / 6%); }
      .editor { width: auto; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerTasksComponent {
  protected readonly tasks = signal<TrainerTask[]>([...TASKS]);
  protected readonly selectedId = signal<string>('weigh');
  protected readonly message = signal('');

  protected readonly selectedTask = computed(() => this.tasks().find((t) => t.id === this.selectedId()) ?? null);

  protected select(id: string): void {
    this.selectedId.set(id);
    this.message.set('');
  }

  protected newTask(): void {
    this.message.set('Создание задачи появится вместе с модулем «Задачи» на бэкенде.');
  }

  protected save(): void {
    this.message.set('Сохранение появится вместе с модулем «Задачи» на бэкенде.');
  }
}
