import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface WeekMeta {
  label: string;
  status: 'active' | 'copy' | 'locked';
  days: boolean[];
}

interface ExerciseBlock {
  tag: string;
  name: string;
  sets: number;
  reps: string;
  weightKg: number | null;
  restSec: number;
  category: string;
  muscle: string;
  equipment: string;
}

const DAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ'];

const INITIAL_WEEKS: readonly WeekMeta[] = [
  { label: 'Неделя 1', status: 'active', days: [true, false, true, false, true] },
  { label: 'Неделя 2', status: 'copy', days: [false, false, false, false, false] },
  { label: 'Неделя 3', status: 'locked', days: [false, false, false, false, false] },
];

const INITIAL_BLOCKS: readonly ExerciseBlock[] = [
  { tag: 'A1', name: 'Присед со штангой', sets: 4, reps: '8', weightKg: 80, restSec: 90, category: 'Сила', muscle: 'Ноги', equipment: 'Штанга' },
  { tag: 'A2', name: 'Жим ногами', sets: 3, reps: '12', weightKg: 120, restSec: 75, category: 'Сила', muscle: 'Ноги', equipment: 'Тренажёр' },
  { tag: 'B1', name: 'Выпады с гантелями', sets: 3, reps: '10 / нога', weightKg: null, restSec: 60, category: 'Сила', muscle: 'Ноги', equipment: 'Гантели' },
];

@Component({
  selector: 'tt-program-builder',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="workspace">
      <aside class="sidebar desktop-only">
        <a class="sidebar-logo" routerLink="/trainer" aria-label="TopTrainers: Сегодня">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
        </a>
        <nav class="sidebar-nav" aria-label="Навигация тренера">
          <a class="side-item" routerLink="/trainer"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg></span><span>Сегодня</span></a>
          <a class="side-item is-active" routerLink="/trainer/programs"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg></span><span>Программы</span></a>
        </nav>
        <span class="sidebar-avatar" aria-hidden="true"></span>
      </aside>

      <div class="screen">
      <header class="toolbar">
        <div class="toolbar-left">
          <a class="back" routerLink="/trainer/programs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Программы
          </a>
          <h1>Гипертрофия · 8 недель</h1>
          <span class="draft-badge">ЧЕРНОВИК</span>
        </div>
        <div class="toolbar-right">
          <span class="hotkeys">N упр · D дубль · / поиск</span>
          <a class="outline library-link" routerLink="/trainer/programs/library">Упражнения и тренировки</a>
          <button type="button" class="outline" (click)="preview()">Предпросмотр</button>
          <button type="button" class="fill" (click)="publish()">Опубликовать</button>
        </div>
      </header>

      <div class="panels">
        <aside class="panel panel-weeks">
          <p class="panel-title">КАЛЕНДАРЬ НЕДЕЛЬ</p>
          @for (week of weeks(); track week.label; let i = $index) {
            <button
              type="button"
              class="week-card"
              [class.is-active]="i === selectedWeekIndex()"
              [class.is-locked]="week.status === 'locked'"
              (click)="selectWeek(i)"
            >
              <div class="week-head">
                <span>{{ week.label }}</span>
                @if (week.status === 'active') {
                  <span class="week-status week-status--active">актив.</span>
                } @else if (week.status === 'copy') {
                  <span class="week-status">копия ▾</span>
                }
              </div>
              @if (week.status !== 'locked') {
                <div class="week-days">
                  @for (filled of week.days; track $index) {
                    <span [class.is-filled]="filled">{{ dayLabels[$index] }}</span>
                  }
                </div>
              }
            </button>
          }
          <button type="button" class="add-week" (click)="addWeek()">＋ Неделя <i>Заполнить</i></button>
        </aside>

        <section class="panel panel-day">
          <div class="day-head">
            <div>
              <p class="panel-title">НЕДЕЛЯ {{ selectedWeekIndex() + 1 }} · ДЕНЬ 3</p>
              <h2>Ноги</h2>
            </div>
            <span class="day-meta">{{ blocks().length }} блока · ~60 мин</span>
          </div>

          <div class="block-list">
            @for (block of blocks(); track block.tag; let i = $index) {
              <article class="block" [class.is-selected]="i === selectedBlockIndex()" (click)="selectBlock(i)">
                <div class="block-row">
                  <span class="block-tag" [class.is-selected]="i === selectedBlockIndex()">{{ block.tag }}</span>
                  <span class="block-name">{{ block.name }}</span>
                  <span class="drag-handle">⠿</span>
                </div>
                <div class="chip-row">
                  <span class="chip">{{ block.sets }} × {{ block.reps }}</span>
                  @if (block.weightKg !== null) {
                    <span class="chip chip--lime">@ {{ block.weightKg }} кг</span>
                  }
                  <span class="chip chip--muted">отдых {{ block.restSec }} с</span>
                </div>
              </article>
            }
          </div>

          <div class="add-row">
            <button type="button" class="dashed" (click)="addBlock()">＋ Блок</button>
            <button type="button" class="dashed" (click)="addSuperset()">＋ Суперсет</button>
          </div>
        </section>

        <aside class="panel panel-inspector">
          @if (selectedBlock(); as block) {
            <div class="inspector-head">
              <span class="panel-title">УПРАЖНЕНИЕ · {{ block.tag }}</span>
              <button type="button" class="close" (click)="closeInspector()" aria-label="Закрыть">✕</button>
            </div>
            <div class="media-placeholder">[ медиа ]</div>
            <div class="field">
              <label>Название</label>
              <input type="text" [value]="block.name" (change)="renameBlock($event, block.tag)" />
            </div>
            <div class="field-row">
              <div class="field">
                <label>Категория</label>
                <div class="select">{{ block.category }} <span>▾</span></div>
              </div>
              <div class="field">
                <label>Мышцы</label>
                <div class="select">{{ block.muscle }} <span>▾</span></div>
              </div>
            </div>
            <div class="field">
              <label>Оборудование</label>
              <div class="select">{{ block.equipment }} <span>▾</span></div>
            </div>
            <div class="field">
              <label>Медиа</label>
              <div class="media-actions">
                <button type="button" class="outline" (click)="mediaAction('Файл')">Файл</button>
                <button type="button" class="outline" (click)="mediaAction('Ссылка')">Ссылка</button>
                <button type="button" class="fill" (click)="mediaAction('Библиотека')">Библ.</button>
              </div>
            </div>
          } @else {
            <p class="inspector-empty">Выберите блок слева, чтобы увидеть детали упражнения.</p>
          }
        </aside>
      </div>

      @if (message()) {
        <p class="form-message">{{ message() }}</p>
      }
      </div>

      <nav class="mobile-nav mobile-only" aria-label="Навигация тренера">
        <a class="mobile-nav__item" routerLink="/trainer"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg><span>Сегодня</span></a>
        <a class="mobile-nav__item is-active" routerLink="/trainer/programs"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Программы</span></a>
      </nav>
    </div>
  `,
  styles: `
    :host { display: block; }
    .workspace { min-height: 100dvh; background: #14181d; }
    .screen { min-width: 0; min-height: 100dvh; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .sidebar { width: 5.5rem; flex-shrink: 0; background: #0e1116; border-right: 1px solid rgb(245 247 250 / 6%); display: flex; flex-direction: column; align-items: center; padding: 1.25rem 0; box-sizing: border-box; }
    .sidebar-logo { color: #c9f24b; }
    .sidebar-nav { display: flex; flex-direction: column; align-items: center; gap: 1.375rem; margin-top: 2rem; }
    .side-item { display: flex; flex-direction: column; align-items: center; gap: 0.3125rem; color: #8a94a6; text-decoration: none; font-size: 0.5625rem; }
    .side-icon { display: flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; }
    .side-item.is-active { color: #c9f24b; font-weight: 600; }
    .side-item.is-active .side-icon { background: rgb(201 242 75 / 12%); }
    .sidebar-avatar { margin-top: auto; width: 2.5rem; height: 2.5rem; border-radius: 999px; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 1.125rem 1.75rem; border-bottom: 1px solid rgb(245 247 250 / 6%); gap: 1rem; flex-wrap: wrap; }
    .toolbar-left { display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap; }
    .back { display: inline-flex; align-items: center; gap: 0.375rem; color: #8a94a6; text-decoration: none; font-size: 0.875rem; }
    .toolbar h1 { margin: 0; font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.125rem; color: #f5f7fa; }
    .draft-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #c9f24b; background: rgb(201 242 75 / 12%); padding: 0.1875rem 0.5rem; border-radius: 999px; }
    .toolbar-right { display: flex; align-items: center; gap: 0.625rem; }
    .hotkeys { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
    .outline, .fill, .dashed {
      font: inherit;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 0.5625rem 1rem;
      border-radius: 0.5625rem;
      cursor: pointer;
    }
    .outline { border: 1px solid rgb(245 247 250 / 16%); background: transparent; color: #f5f7fa; }
    .library-link { text-decoration: none; display: inline-flex; align-items: center; }
    .fill { border: 0; font-weight: 700; color: #14181d; background: #c9f24b; }
    .panels { display: flex; min-height: calc(100dvh - 4.5rem); }
    .panel { padding: 1.25rem 1rem; }
    .panel-title { margin: 0 0 0.75rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; }
    .panel-weeks { width: 15rem; border-right: 1px solid rgb(245 247 250 / 6%); flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .week-card { text-align: left; background: #1c222b; border: 1px solid transparent; border-radius: 0.75rem; padding: 0.875rem; cursor: pointer; color: inherit; font: inherit; }
    .week-card.is-active { border-color: #c9f24b; }
    .week-card.is-locked { opacity: 0.65; cursor: default; }
    .week-head { display: flex; justify-content: space-between; align-items: center; }
    .week-head span:first-child { font-weight: 600; font-size: 0.875rem; color: #f5f7fa; }
    .week-status { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .week-status--active { color: #c9f24b; }
    .week-days { display: flex; gap: 0.25rem; margin-top: 0.625rem; }
    .week-days span {
      flex: 1;
      height: 1.25rem;
      border-radius: 0.3125rem;
      background: rgb(245 247 250 / 8%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.5rem;
      color: #5b6472;
    }
    .week-days span.is-filled { background: #c9f24b; color: #14181d; }
    .add-week {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      margin-top: 0.25rem;
      padding: 0.75rem;
      border: 1.5px dashed rgb(245 247 250 / 18%);
      border-radius: 0.75rem;
      background: transparent;
      color: #8a94a6;
      font-weight: 600;
      font-size: 0.8125rem;
      cursor: pointer;
    }
    .add-week i { font-style: normal; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #c9f24b; margin-left: 0.25rem; }
    .panel-day { flex: 1; border-right: 1px solid rgb(245 247 250 / 6%); padding: 1.5rem 1.75rem; }
    .day-head { display: flex; justify-content: space-between; align-items: center; }
    .day-head h2 { margin: 0.375rem 0 0; font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.375rem; color: #f5f7fa; }
    .day-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #8a94a6; }
    .block-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.25rem; }
    .block { background: #1c222b; border-radius: 0.875rem; padding: 1rem 1.125rem; border: 1px solid transparent; cursor: pointer; }
    .block.is-selected { border-color: #2f5cff; }
    .block-row { display: flex; align-items: center; gap: 0.75rem; }
    .block-tag {
      width: 1.625rem;
      height: 1.625rem;
      border-radius: 0.4375rem;
      background: #2a323d;
      color: #f5f7fa;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .block-tag.is-selected { background: #2f5cff; color: #fff; }
    .block-name { flex: 1; font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
    .drag-handle { color: #5b6472; }
    .chip-row { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
    .chip { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; background: #14181d; color: #f5f7fa; padding: 0.375rem 0.75rem; border-radius: 0.5rem; }
    .chip--lime { color: #c9f24b; }
    .chip--muted { color: #8a94a6; }
    .add-row { display: flex; gap: 0.625rem; margin-top: 0.25rem; }
    .dashed { flex: 1; text-align: center; border: 1.5px dashed rgb(245 247 250 / 18%); background: transparent; color: #8a94a6; }
    .panel-inspector { width: 21.25rem; flex-shrink: 0; }
    .inspector-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .inspector-head .panel-title { margin: 0; }
    .close { border: 0; background: transparent; color: #8a94a6; font-size: 1rem; cursor: pointer; }
    .media-placeholder {
      height: 9.375rem;
      border-radius: 0.75rem;
      border: 1px solid rgb(245 247 250 / 8%);
      background: repeating-linear-gradient(135deg, #1c222b, #1c222b 12px, #20272f 12px, #20272f 24px);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8a94a6;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.6875rem;
    }
    .field { margin-top: 0.75rem; }
    .field label { display: block; margin-bottom: 0.375rem; font-size: 0.6875rem; color: #8a94a6; }
    .field input, .select {
      width: 100%;
      box-sizing: border-box;
      background: #1c222b;
      border: 1px solid rgb(245 247 250 / 10%);
      border-radius: 0.5625rem;
      padding: 0.6875rem 0.875rem;
      color: #f5f7fa;
      font: inherit;
      font-size: 0.875rem;
    }
    .select { display: flex; justify-content: space-between; align-items: center; color: #f5f7fa; cursor: default; }
    .select span { color: #8a94a6; }
    .field-row { display: flex; gap: 0.625rem; }
    .field-row .field { flex: 1; }
    .media-actions { display: flex; gap: 0.5rem; }
    .media-actions button { flex: 1; padding: 0.625rem; font-size: 0.75rem; }
    .inspector-empty { color: #8a94a6; font-size: 0.875rem; line-height: 1.5; }
    .form-message { padding: 0 1.75rem 1rem; font-size: 0.8125rem; color: #8a94a6; }
    .mobile-only { display: none; }
    @media (min-width: 860px) { .workspace { display: flex; } .desktop-only { display: flex; } .screen { flex: 1; } }
    @media (max-width: 859.98px) {
      .desktop-only { display: none; }
      .mobile-only { display: flex; }
      .screen { padding-bottom: 5.5rem; }
      .mobile-nav { position: fixed; z-index: 10; inset-inline: 0; bottom: 0; justify-content: space-around; padding: 0.625rem 1rem calc(0.625rem + env(safe-area-inset-bottom)); border-top: 1px solid rgb(245 247 250 / 8%); background: rgb(14 17 22 / 96%); backdrop-filter: blur(12px); }
      .mobile-nav__item { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; color: #8a94a6; text-decoration: none; font-size: 0.625rem; }
      .mobile-nav__item.is-active { color: #c9f24b; font-weight: 700; }
    }
    @media (max-width: 1079.98px) {
      .panels { overflow-x: auto; }
      .panel-weeks, .panel-inspector { min-width: 15rem; }
      .panel-day { min-width: 24rem; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramBuilderComponent {
  protected readonly dayLabels = DAY_LABELS;
  protected readonly weeks = signal<WeekMeta[]>([...INITIAL_WEEKS]);
  protected readonly blocks = signal<ExerciseBlock[]>([...INITIAL_BLOCKS]);
  protected readonly selectedWeekIndex = signal(0);
  protected readonly selectedBlockIndex = signal<number | null>(0);
  protected readonly message = signal('');

  protected readonly selectedBlock = computed(() => {
    const index = this.selectedBlockIndex();
    if (index === null) return null;
    return this.blocks()[index] ?? null;
  });

  protected selectWeek(index: number): void {
    if (this.weeks()[index]?.status === 'locked') return;
    this.selectedWeekIndex.set(index);
  }

  protected selectBlock(index: number): void {
    this.selectedBlockIndex.set(index);
  }

  protected closeInspector(): void {
    this.selectedBlockIndex.set(null);
  }

  protected addWeek(): void {
    this.weeks.update((items) => [
      ...items,
      { label: `Неделя ${items.length + 1}`, status: 'copy', days: [false, false, false, false, false] },
    ]);
  }

  protected addBlock(): void {
    this.blocks.update((items) => {
      const tag = `A${items.length + 1}`;
      return [...items, { tag, name: 'Новое упражнение', sets: 3, reps: '10', weightKg: null, restSec: 60, category: 'Сила', muscle: '—', equipment: '—' }];
    });
  }

  protected addSuperset(): void {
    this.addBlock();
    this.message.set('Суперсет создан как отдельный блок — группировка появится позже.');
  }

  protected renameBlock(event: Event, tag: string): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (!value) return;
    this.blocks.update((items) => items.map((block) => (block.tag === tag ? { ...block, name: value } : block)));
  }

  protected preview(): void {
    this.message.set('Предпросмотр программы появится вместе с публичной витриной программ.');
  }

  protected publish(): void {
    this.message.set('Публикация появится, когда конструктор будет сохранён на бэкенде.');
  }

  protected mediaAction(source: string): void {
    this.message.set(`Загрузка медиа (${source}) появится вместе с хранилищем файлов.`);
  }
}
