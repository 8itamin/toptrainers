import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type CellKind = 'workout' | 'cardio' | 'task' | 'deload' | 'test' | 'rest' | 'empty';

interface Cell {
  kind: CellKind;
  title?: string;
  sub?: string; // e.g. '55 МИН' | '+2,5 КГ'
  extra?: { kind: 'task'; title: string };
}

interface Week {
  label: string;
  dim?: boolean;
  cells: Cell[];
}

const W = (title: string, sub?: string): Cell => ({ kind: 'workout', title, sub });
const CARDIO = (title: string): Cell => ({ kind: 'cardio', title });
const TASK = (title: string): Cell => ({ kind: 'task', title });
const REST: Cell = { kind: 'rest' };
const EMPTY: Cell = { kind: 'empty' };

const WEEKS: readonly Week[] = [
  {
    label: 'Н1',
    cells: [W('Ноги + кор', '55 МИН'), TASK('Взвеситься'), W('Грудь + трицепс', '50 МИН'), CARDIO('Кардио + мобильность'), W('Спина + бицепс', '55 МИН'), EMPTY, REST],
  },
  {
    label: 'Н2',
    cells: [W('Ноги + кор', '+2,5 КГ'), TASK('Взвеситься'), W('Грудь + трицепс'), CARDIO('Кардио + мобильность'), { kind: 'workout', title: 'Спина + бицепс', extra: { kind: 'task', title: 'Фото-прогресс' } }, EMPTY, REST],
  },
  {
    label: 'Н3',
    dim: true,
    cells: [W('Ноги + кор'), TASK('Взвеситься'), W('Грудь + трицепс'), CARDIO('Кардио'), W('Спина + бицепс'), EMPTY, REST],
  },
  {
    label: 'Н4',
    cells: [{ kind: 'deload', title: 'Ноги · разгрузка', sub: '−30 % ОБЪЁМ' }, TASK('Взвеситься'), { kind: 'deload', title: 'Верх · разгрузка' }, REST, { kind: 'test', title: 'Контроль-тест', sub: '1ПМ ПРИСЕД' }, EMPTY, REST],
  },
];

const DAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

@Component({
  selector: 'tt-program-schedule',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="toolbar">
        <div class="left">
          <a class="back" routerLink="/trainer/library"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Программы</a>
          <span class="pname">Гипертрофия · 8 недель</span>
          <span class="badge">НАЗНАЧЕНА 14</span>
        </div>
        <div class="right">
          <div class="view-toggle">
            <button type="button" [class.is-active]="view() === 'week'" (click)="view.set('week')">Неделя</button>
            <button type="button" [class.is-active]="view() === 'month'" (click)="view.set('month')">Месяц</button>
          </div>
          <button type="button" class="outline" (click)="assign()">Назначить клиентам</button>
          <button type="button" class="fill" (click)="publish()">Опубликовать</button>
        </div>
      </header>

      <div class="panels">
        <aside class="sources">
          <div>
            <div class="label">ТРЕНИРОВКИ · ТЯНИТЕ В СЕТКУ</div>
            <div class="src-list">
              <div class="src src--lime"><span class="drag">⠿</span><span class="src-text"><span class="src-name">Ноги + кор</span><span class="src-meta">6 УПР · 55 МИН</span></span></div>
              <div class="src src--lime"><span class="drag">⠿</span><span class="src-text"><span class="src-name">Грудь + трицепс</span><span class="src-meta">5 УПР · 50 МИН</span></span></div>
              <div class="src src--lime"><span class="drag">⠿</span><span class="src-text"><span class="src-name">Спина + бицепс</span><span class="src-meta">6 УПР · 55 МИН</span></span></div>
              <div class="src src--blue"><span class="drag">⠿</span><span class="src-text"><span class="src-name">Кардио + мобильность</span><span class="src-meta">4 УПР · 35 МИН</span></span></div>
            </div>
          </div>
          <div>
            <div class="label">ЗАДАЧИ</div>
            <div class="src-list">
              <div class="src"><span class="drag">⠿</span><span class="src-dot src-dot--gold"></span><span class="src-name">Взвеситься</span></div>
              <div class="src"><span class="drag">⠿</span><span class="src-dot src-dot--blue"></span><span class="src-name">Фото-прогресс</span></div>
              <div class="src"><span class="drag">⠿</span><span class="src-dot src-dot--lime"></span><span class="src-name">Замеры талии</span></div>
            </div>
          </div>
          <div class="tip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>
            <span>Неделя 1 — шаблон. «Копировать на 4 недели» размножит сетку с шагом прогрессии.</span>
          </div>
        </aside>

        <section class="grid-wrap">
          <div class="grid-head">
            <span class="grid-title">РАСПИСАНИЕ · МЕСЯЦ 1 · НЕДЕЛИ 1–4</span>
            <div class="legend">
              <span><span class="ldot" style="background:#c9f24b"></span>ТРЕНИРОВКА</span>
              <span><span class="ldot" style="background:#2f5cff"></span>КАРДИО</span>
              <span><span class="ldot" style="background:#e7b54a"></span>ЗАДАЧА</span>
            </div>
          </div>

          <div class="grid">
            <span class="corner"></span>
            @for (d of dayLabels; track d) { <span class="day-label">{{ d }}</span> }
            @for (week of weeks; track week.label) {
              <span class="week-label" [class.dim]="week.dim">{{ week.label }}</span>
              @for (cell of week.cells; track $index) {
                @switch (cell.kind) {
                  @case ('workout') { <div class="cell" [class.dim]="week.dim"><span class="chip chip--lime">{{ cell.title }}</span>@if (cell.sub) {<span class="cell-sub" [class.lime]="cell.sub!.startsWith('+')">{{ cell.sub }}</span>}@if (cell.extra) {<span class="chip chip--gold">{{ cell.extra.title }}</span>}</div> }
                  @case ('cardio') { <div class="cell" [class.dim]="week.dim"><span class="chip chip--blue">{{ cell.title }}</span></div> }
                  @case ('task') { <div class="cell" [class.dim]="week.dim"><span class="chip chip--gold">{{ cell.title }}</span></div> }
                  @case ('deload') { <div class="cell"><span class="chip chip--grey">{{ cell.title }}</span>@if (cell.sub) {<span class="cell-sub">{{ cell.sub }}</span>}</div> }
                  @case ('test') { <div class="cell"><span class="chip chip--test">{{ cell.title }}</span>@if (cell.sub) {<span class="cell-sub">{{ cell.sub }}</span>}</div> }
                  @case ('rest') { <div class="cell cell--rest"><span>ОТДЫХ</span></div> }
                  @case ('empty') { <button type="button" class="cell cell--empty" (click)="addCell()">＋</button> }
                }
              }
            }
          </div>

          <div class="grid-actions">
            <button type="button" class="dashed" (click)="addWeek()">＋ Неделя 5</button>
            <button type="button" class="dashed" (click)="copyMonth()">Копировать месяц с прогрессией</button>
          </div>
        </section>

        <aside class="inspector">
          <div class="ins-title">ПРОГРАММА</div>
          <div class="field"><div class="label">НАЗВАНИЕ</div><div class="value">Гипертрофия · 8 недель</div></div>
          <div class="field-row">
            <div class="field"><div class="label">ДЛИНА</div><div class="value select">8 нед <span>▾</span></div></div>
            <div class="field"><div class="label">ШАГ</div><div class="value select">Неделя <span>▾</span></div></div>
          </div>
          <div class="ins-card">
            <div class="label">В ПРОГРАММЕ</div>
            <div class="ins-scores">
              <div><span class="ins-val lime">17</span><span class="ins-lbl">ТРЕНИРОВОК</span></div>
              <div><span class="ins-val gold">9</span><span class="ins-lbl">ЗАДАЧ</span></div>
            </div>
          </div>
          <div>
            <div class="label">НАЗНАЧЕНА · 14 КЛИЕНТОВ</div>
            <div class="avatars"><span class="av"></span><span class="av"></span><span class="av"></span><span class="av av--more">+11</span></div>
          </div>
          <div class="ins-actions">
            <button type="button" class="ins-btn" (click)="duplicate()">Дублировать программу</button>
            <button type="button" class="ins-btn ins-btn--danger" (click)="archive()">Архивировать</button>
          </div>
          @if (message()) { <p class="message">{{ message() }}</p> }
        </aside>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 1.125rem 1.75rem; border-bottom: 1px solid rgb(245 247 250 / 6%); gap: 1rem; flex-wrap: wrap; }
    .left { display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap; }
    .back { display: inline-flex; align-items: center; gap: 0.5rem; color: #8a94a6; text-decoration: none; font-size: 0.875rem; }
    .pname { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.125rem; color: #f5f7fa; }
    .badge { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #c9f24b; background: rgb(201 242 75 / 12%); padding: 0.1875rem 0.5rem; border-radius: 999px; }
    .right { display: flex; align-items: center; gap: 0.625rem; }
    .view-toggle { display: flex; gap: 0.25rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 6%); border-radius: 0.625rem; padding: 0.25rem; }
    .view-toggle button { border: 0; background: transparent; color: #8a94a6; font: inherit; font-size: 0.8125rem; font-weight: 500; padding: 0.4375rem 0.875rem; border-radius: 0.4375rem; cursor: pointer; }
    .view-toggle button.is-active { font-weight: 700; color: #14181d; background: #c9f24b; }
    .outline, .fill { font: inherit; font-weight: 600; font-size: 0.875rem; padding: 0.5625rem 1rem; border-radius: 0.5625rem; cursor: pointer; }
    .outline { border: 1px solid rgb(245 247 250 / 16%); background: transparent; color: #f5f7fa; }
    .fill { border: 0; font-weight: 700; color: #14181d; background: #c9f24b; }
    .panels { display: flex; min-height: calc(100dvh - 4.5rem); }
    .sources { width: 18.75rem; flex: none; border-right: 1px solid rgb(245 247 250 / 6%); padding: 1.25rem 1.125rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; margin-bottom: 0.625rem; }
    .src-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .src { display: flex; align-items: center; gap: 0.625rem; background: #1c222b; border-radius: 0.6875rem; padding: 0.75rem 0.8125rem; }
    .src--lime { border-left: 3px solid #c9f24b; }
    .src--blue { border-left: 3px solid #2f5cff; }
    .drag { color: #5b6472; }
    .src-text { flex: 1; min-width: 0; }
    .src-name { display: block; font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; }
    .src-meta { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #8a94a6; margin-top: 0.1875rem; }
    .src-dot { width: 1.25rem; height: 1.25rem; border-radius: 0.375rem; flex: none; }
    .src-dot--gold { background: rgb(231 181 74 / 16%); }
    .src-dot--blue { background: rgb(47 92 255 / 16%); }
    .src-dot--lime { background: rgb(201 242 75 / 14%); }
    .tip { margin-top: auto; display: flex; align-items: flex-start; gap: 0.5625rem; padding: 0.75rem 0.8125rem; background: #1c222b; border-radius: 0.6875rem; }
    .tip svg { flex: none; margin-top: 0.0625rem; }
    .tip span { font-size: 0.75rem; line-height: 1.45; color: #8a94a6; }
    .grid-wrap { flex: 1; min-width: 0; padding: 1.375rem 1.625rem; overflow-x: auto; }
    .grid-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.875rem; gap: 1rem; flex-wrap: wrap; }
    .grid-title { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; letter-spacing: 0.08em; color: #f5f7fa; font-weight: 700; }
    .legend { display: flex; align-items: center; gap: 0.875rem; }
    .legend span { display: flex; align-items: center; gap: 0.375rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .ldot { width: 0.5625rem; height: 0.5625rem; border-radius: 0.1875rem; }
    .grid { display: grid; grid-template-columns: 3.25rem repeat(7, minmax(6.5rem, 1fr)); gap: 0.5rem; min-width: 48rem; }
    .day-label, .corner { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; text-align: center; }
    .week-label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #f5f7fa; display: flex; align-items: center; justify-content: center; background: #1c222b; border-radius: 0.5625rem; }
    .week-label.dim { color: #8a94a6; }
    .cell { min-height: 6.5rem; background: #1c222b; border-radius: 0.6875rem; padding: 0.4375rem; display: flex; flex-direction: column; gap: 0.3125rem; }
    .cell.dim { opacity: 0.72; }
    .cell--rest { background: rgb(28 34 43 / 50%); align-items: center; justify-content: center; }
    .cell--rest span { font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #5b6472; }
    .cell--empty { border: 1.5px dashed rgb(245 247 250 / 14%); background: transparent; color: #5b6472; font-size: 1rem; align-items: center; justify-content: center; cursor: pointer; }
    .chip { font-size: 0.6875rem; font-weight: 700; color: #14181d; padding: 0.4375rem 0.5rem; border-radius: 0.4375rem; line-height: 1.25; }
    .chip--lime { background: #c9f24b; }
    .chip--blue { color: #fff; background: #2f5cff; font-weight: 600; }
    .chip--gold { color: #e7b54a; background: rgb(231 181 74 / 14%); font-weight: 600; }
    .chip--grey { color: #f5f7fa; background: #2a323d; font-weight: 600; }
    .chip--test { color: #14181d; background: #e7b54a; font-weight: 600; }
    .cell-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #5b6472; padding-left: 0.125rem; }
    .cell-sub.lime { color: #c9f24b; }
    .grid-actions { display: flex; gap: 0.625rem; margin-top: 0.875rem; }
    .dashed { flex: 1; text-align: center; padding: 0.75rem; border: 1.5px dashed rgb(245 247 250 / 18%); border-radius: 0.75rem; background: transparent; color: #8a94a6; font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
    .inspector { width: 18.75rem; flex: none; border-left: 1px solid rgb(245 247 250 / 6%); padding: 1.5rem 1.375rem; display: flex; flex-direction: column; gap: 1.125rem; }
    .ins-title { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #f5f7fa; font-weight: 700; }
    .field .label { display: block; }
    .value { background: #1c222b; border: 1px solid rgb(245 247 250 / 10%); border-radius: 0.625rem; padding: 0.75rem 0.8125rem; font-size: 0.875rem; font-weight: 600; color: #f5f7fa; }
    .value.select { display: flex; justify-content: space-between; align-items: center; font-weight: 400; }
    .value.select span { color: #8a94a6; }
    .field-row { display: flex; gap: 0.5rem; }
    .field-row .field { flex: 1; }
    .ins-card { background: #1c222b; border-radius: 0.75rem; padding: 0.875rem; }
    .ins-card .label { margin-bottom: 0; }
    .ins-scores { display: flex; gap: 1rem; margin-top: 0.75rem; }
    .ins-val { display: block; font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.375rem; }
    .ins-val.lime { color: #c9f24b; }
    .ins-val.gold { color: #e7b54a; }
    .ins-lbl { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #8a94a6; margin-top: 0.1875rem; }
    .avatars { display: flex; align-items: center; }
    .av { width: 2.125rem; height: 2.125rem; border-radius: 999px; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); border: 2px solid #14181d; }
    .av + .av { margin-left: -0.625rem; }
    .av--more { background: #2a323d; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #f5f7fa; }
    .ins-actions { margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem; }
    .ins-btn { text-align: center; font: inherit; font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; background: #1c222b; border: 1px solid rgb(245 247 250 / 12%); padding: 0.75rem; border-radius: 0.625rem; cursor: pointer; }
    .ins-btn--danger { color: #ff4d5e; background: transparent; border-color: rgb(255 77 94 / 28%); }
    .message { margin: 0; font-size: 0.75rem; color: #8a94a6; }
    @media (max-width: 1200px) {
      .panels { flex-wrap: wrap; }
      .sources, .inspector { width: 100%; border-right: 0; border-left: 0; border-bottom: 1px solid rgb(245 247 250 / 6%); }
      .grid-wrap { flex: 1 1 100%; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramScheduleComponent {
  protected readonly dayLabels = DAY_LABELS;
  protected readonly weeks = WEEKS;
  protected readonly view = signal<'week' | 'month'>('month');
  protected readonly message = signal('');

  protected addCell(): void {
    this.message.set('Перетаскивание тренировок и задач в сетку появится вместе с сохранением расписания.');
  }

  protected addWeek(): void {
    this.message.set('Добавление недели появится вместе с сохранением расписания.');
  }

  protected copyMonth(): void {
    this.message.set('Копирование месяца с прогрессией появится вместе с сохранением расписания.');
  }

  protected assign(): void {
    this.message.set('Назначение клиентам уже работает в текущем конструкторе программ (/trainer/programs).');
  }

  protected publish(): void {
    this.message.set('Публикация появится вместе с сохранением расписания.');
  }

  protected duplicate(): void {
    this.message.set('Дублирование программы появится вместе с сохранением расписания.');
  }

  protected archive(): void {
    this.message.set('Архивирование появится вместе с сохранением расписания.');
  }
}
