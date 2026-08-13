import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type Tone = 'muted' | 'lime' | 'copper' | 'red';
type ClientGroup = 'active' | 'risk' | 'new';
type RibbonState = 'done' | 'idle' | 'future';

interface Client {
  id: string;
  name: string;
  meta: string;
  metaTone: Tone;
  program: string;
  programMuted: boolean;
  completion: number | null;
  completionTone: Tone;
  activity: string;
  activityTone: Tone;
  paymentLabel: string;
  paymentTone: Tone;
  group: ClientGroup;
  plan: string;
  streakDays: number;
  workouts: number;
  ribbon: readonly RibbonState[];
  currentProgram: string;
  programPct: number;
  programWeek: string;
  noteText: string;
  noteMeta: string;
}

const RIBBON_FULL: readonly RibbonState[] = ['done', 'done', 'idle', 'done', 'done', 'done', 'future'];
const RIBBON_LOW: readonly RibbonState[] = ['done', 'idle', 'idle', 'future', 'future', 'future', 'future'];

const DEFAULT_CLIENT_ID = 'ivan';

const CLIENTS: readonly Client[] = [
  {
    id: 'ivan', name: 'Иван П.', meta: 'стрик 30 дней', metaTone: 'muted',
    program: 'Гипертрофия · 8 нед', programMuted: false, completion: 92, completionTone: 'lime',
    activity: 'сегодня', activityTone: 'muted', paymentLabel: 'активна', paymentTone: 'lime', group: 'active',
    plan: 'ПРОФИ · до 12 сен', streakDays: 30, workouts: 48, ribbon: RIBBON_FULL,
    currentProgram: 'Гипертрофия · 8 недель', programPct: 62, programWeek: 'нед 5/8',
    noteText: 'Новый видеоотчёт · присед', noteMeta: 'ждёт ответа · сегодня',
  },
  {
    id: 'maria', name: 'Мария К.', meta: 'стрик 8 дней', metaTone: 'muted',
    program: 'Жиросжигание · 12 нед', programMuted: false, completion: 78, completionTone: 'lime',
    activity: '2 часа назад', activityTone: 'muted', paymentLabel: 'активна', paymentTone: 'lime', group: 'active',
    plan: 'ПРОФИ · до 20 окт', streakDays: 8, workouts: 22, ribbon: RIBBON_FULL,
    currentProgram: 'Жиросжигание · 12 недель', programPct: 33, programWeek: 'нед 4/12',
    noteText: 'Вопрос по питанию', noteMeta: 'ждёт ответа · 2 часа назад',
  },
  {
    id: 'anna', name: 'Анна В.', meta: '−1,4 кг / нед', metaTone: 'muted',
    program: 'Старт · новичок', programMuted: false, completion: 64, completionTone: 'lime',
    activity: 'вчера', activityTone: 'muted', paymentLabel: 'до 12 сен', paymentTone: 'copper', group: 'active',
    plan: 'СТАРТ · до 12 сен', streakDays: 5, workouts: 9, ribbon: RIBBON_FULL,
    currentProgram: 'Старт · 4 недели', programPct: 50, programWeek: 'нед 2/4',
    noteText: 'Внесла замер: −1,4 кг', noteMeta: 'сегодня',
  },
  {
    id: 'oleg', name: 'Олег С.', meta: 'пропуск 3 дня', metaTone: 'copper',
    program: 'Сила · 6 нед', programMuted: false, completion: 38, completionTone: 'copper',
    activity: '4 дня назад', activityTone: 'copper', paymentLabel: 'просрочена', paymentTone: 'red', group: 'risk',
    plan: 'ПРОФИ · просрочена', streakDays: 0, workouts: 14, ribbon: RIBBON_LOW,
    currentProgram: 'Сила · 6 недель', programPct: 40, programWeek: 'нед 3/6',
    noteText: 'Пропуск 3 тренировок', noteMeta: 'риск оттока · 4 дня назад',
  },
  {
    id: 'dmitry', name: 'Дмитрий Р.', meta: 'новый · 2 дня', metaTone: 'lime',
    program: 'не назначена', programMuted: true, completion: null, completionTone: 'muted',
    activity: '1 час назад', activityTone: 'muted', paymentLabel: 'активна', paymentTone: 'lime', group: 'new',
    plan: 'СТАРТ · пробный', streakDays: 1, workouts: 0, ribbon: RIBBON_LOW,
    currentProgram: 'Программа не назначена', programPct: 0, programWeek: 'нед 0',
    noteText: 'Завершил онбординг', noteMeta: 'новый клиент · 1 час назад',
  },
];

interface FilterChip {
  key: 'all' | ClientGroup;
  label: string;
  count: number;
  tone: Tone;
}

const FILTERS: readonly FilterChip[] = [
  { key: 'all', label: 'Все', count: 48, tone: 'lime' },
  { key: 'active', label: 'Активные', count: 42, tone: 'muted' },
  { key: 'risk', label: 'Риск оттока', count: 2, tone: 'copper' },
  { key: 'new', label: 'Новые', count: 3, tone: 'muted' },
];

@Component({
  selector: 'tt-trainer-clients',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="crm">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
        </div>
        <nav class="sidebar-nav" aria-label="Навигация">
          <a class="side-item" routerLink="/trainer">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg></span>
            <span>Сегодня</span>
          </a>
          <a class="side-item is-active" routerLink="/trainer/clients">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg></span>
            <span>Клиенты</span>
          </a>
          <a class="side-item" routerLink="/trainer/programs">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg></span>
            <span>Программы</span>
          </a>
          <a class="side-item" routerLink="/trainer/chats">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg></span>
            <span>Чаты</span>
          </a>
          <a class="side-item" routerLink="/trainer/competitions">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg></span>
            <span>Соревн.</span>
          </a>
          <a class="side-item" routerLink="/trainer/showcase"><span class="side-icon">▣</span><span>Витрина</span></a>
        </nav>
        <span class="sidebar-avatar"></span>
      </aside>

      <div class="main">
        <div class="toolbar">
          <div class="title-row">
            <h1>Клиенты</h1>
            <span class="count">48 активных</span>
          </div>
          <div class="tools">
            <label class="search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input type="search" placeholder="Поиск клиента" [value]="query()" (input)="setQuery($event)" />
              <span class="slash">/</span>
            </label>
            <button type="button" class="add" (click)="addClient()">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Клиент
            </button>
          </div>
        </div>

        <div class="chips">
          @for (chip of filters; track chip.key) {
            <button type="button" class="chip" [attr.data-tone]="chip.tone" [class.is-active]="chip.key === activeFilter()" (click)="setFilter(chip.key)">
              {{ chip.label }} · {{ chip.count }}
            </button>
          }
        </div>

        <div class="table-head">
          <span>КЛИЕНТ</span><span>ПРОГРАММА</span><span>ВЫПОЛНЕНИЕ</span><span>АКТИВНОСТЬ</span><span>ОПЛАТА</span>
        </div>

        <div class="rows">
          @for (client of visibleClients(); track client.id) {
            <button
              type="button"
              class="row"
              [class.is-selected]="client.id === selectedId()"
              [attr.data-risk]="client.group === 'risk' ? '' : null"
              (click)="select(client.id)"
            >
              <div class="cell cell-name">
                <span class="avatar"></span>
                <span>
                  <strong>{{ client.name }}</strong>
                  <small [attr.data-tone]="client.metaTone">{{ client.meta }}</small>
                </span>
              </div>
              <div class="cell cell-program" [class.muted]="client.programMuted">{{ client.program }}</div>
              <div class="cell cell-progress">
                <span class="bar"><i [attr.data-tone]="client.completionTone" [style.width.%]="client.completion ?? 0"></i></span>
                <span class="pct">{{ client.completion !== null ? client.completion + '%' : '—' }}</span>
              </div>
              <div class="cell cell-activity" [attr.data-tone]="client.activityTone">{{ client.activity }}</div>
              <div class="cell cell-pay">
                <span class="pay-badge" [attr.data-tone]="client.paymentTone">{{ client.paymentLabel }}</span>
              </div>
            </button>
          } @empty {
            <p class="empty">Клиенты не найдены.</p>
          }
        </div>
      </div>

      @if (selectedClient(); as client) {
        <aside class="profile">
          <div class="profile-head">
            <span class="avatar avatar--lg"></span>
            <div>
              <h2>{{ client.name }}</h2>
              <span class="plan">{{ client.plan }}</span>
            </div>
          </div>

          <div class="score-row">
            <div class="score"><span class="score-value copper">🔥{{ client.streakDays }}</span><small>стрик</small></div>
            <div class="score"><span class="score-value">{{ client.workouts }}</span><small>тренировок</small></div>
            <div class="score"><span class="score-value lime">{{ client.completion ?? 0 }}<i>%</i></span><small>выполн.</small></div>
          </div>

          <div class="profile-ribbon">
            <p class="micro">ЛЕНТА НЕДЕЛИ</p>
            <div class="ribbon">
              @for (state of client.ribbon; track $index) {
                <span [attr.data-state]="state"></span>
              }
            </div>
          </div>

          <div class="profile-card">
            <p class="micro">ТЕКУЩАЯ ПРОГРАММА</p>
            <p class="program-name">{{ client.currentProgram }}</p>
            <div class="program-progress">
              <span class="bar"><i data-tone="blue" [style.width.%]="client.programPct"></i></span>
              <span class="week">{{ client.programWeek }}</span>
            </div>
          </div>

          <div class="note">
            <span class="note-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
            <div><p>{{ client.noteText }}</p><span>{{ client.noteMeta }}</span></div>
          </div>

          <div class="profile-actions">
            <button type="button" class="fill" (click)="write(client.name)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg>
              Написать
            </button>
            <button type="button" class="outline" (click)="openProgram(client.name)">Программа</button>
          </div>

          @if (message()) {
            <p class="form-message">{{ message() }}</p>
          }
        </aside>
      }

      <nav class="tabbar" aria-label="Навигация">
        <a class="tab" routerLink="/trainer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
          <span>Сегодня</span>
        </a>
        <a class="tab is-active" routerLink="/trainer/clients">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg>
          <span>Клиенты</span>
        </a>
        <a class="tab" routerLink="/trainer/programs">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg>
          <span>Программы</span>
        </a>
        <a class="tab" routerLink="/trainer/chats">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg>
          <span>Чаты</span>
        </a>
        <a class="tab" href="#more">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          <span>Ещё</span>
        </a>
        <a class="tab" routerLink="/trainer/showcase"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Витрина</span></a>
      </nav>
    </div>
  `,
  styles: `
    :host { display: block; }
    .crm { min-height: 100dvh; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }

    .sidebar { display: none; }
    .profile { display: none; }

    .main { padding-bottom: 5.5rem; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.25rem 1rem; flex-wrap: wrap; }
    .title-row { display: flex; align-items: baseline; gap: 0.75rem; }
    .title-row h1 { margin: 0; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.375rem; letter-spacing: -0.02em; color: #f5f7fa; }
    .count { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #8a94a6; }
    .tools { display: flex; align-items: center; gap: 0.625rem; }
    .search { display: flex; align-items: center; gap: 0.5625rem; height: 2.625rem; padding: 0 0.875rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); border-radius: 0.6875rem; color: #5b6472; flex: 1; min-width: 0; }
    .search input { flex: 1; min-width: 0; background: transparent; border: 0; color: #f5f7fa; font: inherit; font-size: 0.875rem; }
    .search input::placeholder { color: #5b6472; }
    .search input:focus { outline: none; }
    .slash { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #5b6472; }
    .add { display: flex; align-items: center; gap: 0.4375rem; height: 2.625rem; padding: 0 1rem; border: 0; border-radius: 0.6875rem; background: #c9f24b; color: #14181d; font: inherit; font-weight: 700; font-size: 0.875rem; cursor: pointer; white-space: nowrap; }

    .chips { display: flex; gap: 0.5rem; padding: 0 1.25rem 1rem; overflow-x: auto; }
    .chip { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; padding: 0.4375rem 0.8125rem; border: 0; border-radius: 999px; background: #1c222b; color: #c7ccd6; cursor: pointer; white-space: nowrap; }
    .chip[data-tone='copper'] { color: #e8833a; background: rgb(232 131 58 / 12%); }
    .chip.is-active { font-weight: 700; color: #14181d; background: #c9f24b; }

    .table-head { display: none; }
    .rows { display: flex; flex-direction: column; gap: 0.625rem; padding: 0 1.25rem; }
    .row {
      display: block;
      width: 100%;
      text-align: left;
      background: #1c222b;
      border: 0;
      border-left: 3px solid transparent;
      border-radius: 0.875rem;
      padding: 1rem;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .row[data-risk] { border-left-color: #e8833a; }
    .row.is-selected { outline: 1px solid #2f5cff; }
    .cell-name { display: flex; align-items: center; gap: 0.75rem; }
    .cell-name span { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
    .cell-name strong { font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
    .cell-name small { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
    .cell-name small[data-tone='copper'] { color: #e8833a; }
    .cell-name small[data-tone='lime'] { color: #c9f24b; }
    .avatar { width: 2.5rem; height: 2.5rem; border-radius: 999px; flex-shrink: 0; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }
    .avatar--lg { width: 3.75rem; height: 3.75rem; }
    .cell-program { margin-top: 0.75rem; font-size: 0.875rem; color: #c7ccd6; }
    .cell-program.muted { color: #8a94a6; }
    .cell-progress { display: flex; align-items: center; gap: 0.5625rem; margin-top: 0.625rem; }
    .bar { flex: 1; height: 0.4375rem; border-radius: 999px; background: rgb(245 247 250 / 9%); overflow: hidden; }
    .bar i { display: block; height: 100%; background: #c9f24b; border-radius: 999px; }
    .bar i[data-tone='copper'] { background: #e8833a; }
    .bar i[data-tone='blue'] { background: #2f5cff; }
    .pct { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #f5f7fa; }
    .cell-activity { margin-top: 0.5rem; font-size: 0.8125rem; color: #8a94a6; }
    .cell-activity[data-tone='copper'] { color: #e8833a; }
    .cell-pay { margin-top: 0.625rem; }
    .pay-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; padding: 0.3125rem 0.625rem; border-radius: 999px; color: #c9f24b; background: rgb(201 242 75 / 12%); }
    .pay-badge[data-tone='copper'] { color: #e8833a; background: rgb(232 131 58 / 12%); }
    .pay-badge[data-tone='red'] { color: #ff4d5e; background: rgb(255 77 94 / 12%); }
    .empty { padding: 1.5rem; text-align: center; color: #8a94a6; font-size: 0.875rem; }
    .form-message { font-size: 0.8125rem; color: #8a94a6; margin: 0.75rem 0 0; }

    .tabbar {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom));
      background: #14181d;
      border-top: 1px solid rgb(245 247 250 / 6%);
    }
    .tab { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; color: #5b6472; text-decoration: none; font-size: 0.625rem; }
    .tab.is-active { color: #c9f24b; font-weight: 600; }

    @media (min-width: 1080px) {
      .crm { display: flex; }
      .tabbar { display: none; }
      .main { flex: 1; min-width: 0; padding-bottom: 0; display: flex; flex-direction: column; }

      .sidebar {
        width: 5.5rem;
        background: #0e1116;
        border-right: 1px solid rgb(245 247 250 / 6%);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1.5rem 0;
        gap: 1.625rem;
        flex-shrink: 0;
      }
      .sidebar-logo { color: #c9f24b; }
      .sidebar-nav { display: flex; flex-direction: column; align-items: center; gap: 1.375rem; margin-top: 0.5rem; }
      .side-item { display: flex; flex-direction: column; align-items: center; gap: 0.3125rem; color: #8a94a6; text-decoration: none; font-size: 0.5625rem; }
      .side-icon { display: flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; }
      .side-item.is-active { color: #c9f24b; font-weight: 600; }
      .side-item.is-active .side-icon { background: rgb(201 242 75 / 12%); }
      .sidebar-avatar { margin-top: auto; width: 2.5rem; height: 2.5rem; border-radius: 999px; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }

      .toolbar { padding: 1.5rem 1.75rem 1.125rem; flex-wrap: nowrap; }
      .title-row h1 { font-size: 1.375rem; }
      .search { width: 15rem; flex: none; }
      .chips { padding: 0 1.75rem 1rem; overflow: visible; }

      .table-head {
        display: grid;
        grid-template-columns: 2.2fr 1.6fr 1.4fr 1.2fr 1fr;
        gap: 1rem;
        padding: 0.625rem 1.75rem;
        border-top: 1px solid rgb(245 247 250 / 6%);
        border-bottom: 1px solid rgb(245 247 250 / 6%);
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.625rem;
        letter-spacing: 0.1em;
        color: #5b6472;
      }
      .rows { gap: 0; padding: 0; overflow-y: auto; }
      .row {
        display: grid;
        grid-template-columns: 2.2fr 1.6fr 1.4fr 1.2fr 1fr;
        gap: 1rem;
        align-items: center;
        border-radius: 0;
        border-bottom: 1px solid rgb(245 247 250 / 5%);
        padding: 1rem 1.75rem;
      }
      .row.is-selected { outline: 0; background: rgb(47 92 255 / 8%); border-left-color: #2f5cff; }
      .cell { margin-top: 0; }
      .cell-program, .cell-progress, .cell-activity, .cell-pay { margin-top: 0; }
      .avatar { width: 2.5rem; height: 2.5rem; }

      .profile {
        display: flex;
        flex-direction: column;
        gap: 1.125rem;
        width: 22.5rem;
        flex-shrink: 0;
        border-left: 1px solid rgb(245 247 250 / 6%);
        background: #0e1116;
        padding: 1.625rem 1.5rem;
      }
      .profile-head { display: flex; align-items: center; gap: 0.875rem; }
      .profile-head h2 { margin: 0; font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.1875rem; color: #f5f7fa; }
      .plan { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
      .score-row { display: flex; gap: 0.5rem; }
      .score { flex: 1; background: #1c222b; border-radius: 0.75rem; padding: 0.875rem 0.625rem; text-align: center; }
      .score-value { display: block; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.5rem; line-height: 1; color: #f5f7fa; }
      .score-value.lime { color: #c9f24b; }
      .score-value.copper { color: #e8833a; }
      .score-value i { font-style: normal; font-size: 0.75rem; color: #5b6472; }
      .score small { display: block; margin-top: 0.375rem; font-size: 0.625rem; color: #8a94a6; }
      .micro { margin: 0 0 0.5625rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #8a94a6; }
      .ribbon { display: flex; gap: 0.3125rem; }
      .ribbon span { flex: 1; height: 0.75rem; border-radius: 999px; background: rgb(245 247 250 / 9%); }
      .ribbon span[data-state='done'] { background: #c9f24b; }
      .ribbon span[data-state='future'] { background: transparent; border: 1.5px dashed rgb(245 247 250 / 22%); }
      .profile-card { background: #1c222b; border-radius: 0.875rem; padding: 1rem; }
      .program-name { margin: 0.5rem 0 0; font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
      .program-progress { display: flex; align-items: center; gap: 0.5625rem; margin-top: 0.625rem; }
      .week { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
      .note { display: flex; gap: 0.6875rem; background: #1c222b; border-radius: 0.875rem; padding: 0.875rem 1rem; }
      .note-icon { display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 999px; background: rgb(201 242 75 / 12%); color: #c9f24b; flex-shrink: 0; }
      .note p { margin: 0; font-size: 0.8125rem; color: #f5f7fa; line-height: 1.4; }
      .note span { display: block; margin-top: 0.1875rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
      .profile-actions { display: flex; gap: 0.625rem; margin-top: auto; }
      .fill, .outline { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4375rem; height: 3rem; border-radius: 0.75rem; font: inherit; font-weight: 600; font-size: 0.875rem; cursor: pointer; }
      .fill { border: 0; font-weight: 700; color: #14181d; background: #c9f24b; }
      .outline { border: 1px solid rgb(245 247 250 / 16%); background: transparent; color: #f5f7fa; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerClientsComponent {
  protected readonly filters = FILTERS;
  private readonly clients = signal<Client[]>([...CLIENTS]);
  protected readonly activeFilter = signal<'all' | ClientGroup>('all');
  protected readonly query = signal('');
  protected readonly selectedId = signal<string>(CLIENTS[0]?.id ?? '');
  protected readonly message = signal('');

  protected readonly visibleClients = computed(() => {
    const filter = this.activeFilter();
    const term = this.query().trim().toLowerCase();
    return this.clients().filter((client) => {
      const matchesFilter = filter === 'all' || client.group === filter;
      const matchesQuery = !term || client.name.toLowerCase().includes(term);
      return matchesFilter && matchesQuery;
    });
  });

  protected readonly selectedClient = computed(() => {
    const id = this.selectedId();
    return this.clients().find((client) => client.id === id) ?? null;
  });

  protected setFilter(key: 'all' | ClientGroup): void {
    this.activeFilter.set(key);
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.message.set('');
  }

  protected addClient(): void {
    this.message.set('Добавление клиента появится вместе с приглашениями по ссылке.');
  }

  protected write(name: string): void {
    this.message.set(`Чат с ${name} появится вместе с модулем сообщений.`);
  }

  protected openProgram(name: string): void {
    this.message.set(`Программа клиента ${name} откроется в конструкторе.`);
  }
}
