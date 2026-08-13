import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type QueueCardType = 'video' | 'question' | 'risk';

interface QueueCard {
  type: QueueCardType;
  name: string;
  subtitle: string;
}

type FeedDot = 'lime' | 'blue' | 'gold' | 'red';

interface FeedEvent {
  dot: FeedDot;
  name: string;
  text: string;
  time: string;
}

const QUEUE: readonly QueueCard[] = [
  { type: 'video', name: 'Иван П.', subtitle: 'Видеоотчёт · присед, подход 3' },
  { type: 'question', name: 'Мария К.', subtitle: 'Вопрос по питанию' },
  { type: 'risk', name: 'Олег С.', subtitle: 'Пропуск 3 дня подряд' },
];

const FEED: readonly FeedEvent[] = [
  { dot: 'lime', name: 'Дмитрий Р.', text: 'завершил тренировку «Грудь+трицепс»', time: '10 минут назад' },
  { dot: 'blue', name: 'Мария К.', text: 'оплатила продление «Профи» на 3 месяца', time: '32 минуты назад · +12 900 ₽' },
  { dot: 'gold', name: 'Иван П.', text: 'закрыл стрик 30 дней — новая медаль', time: '1 час назад' },
  { dot: 'lime', name: 'Анна В.', text: 'внесла замер: −1,4 кг за неделю', time: '2 часа назад' },
  { dot: 'red', name: 'Олег С.', text: 'пропустил 3 тренировки — риск оттока', time: 'сегодня' },
];

@Component({
  selector: 'tt-trainer-today',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <ng-template #queueCards>
      @for (card of queue; track card.name) {
        @switch (card.type) {
          @case ('video') {
            <article class="queue-card queue-card--video">
              <div class="queue-row">
                <span class="avatar"></span>
                <span class="queue-body">
                  <strong>{{ card.name }}</strong>
                  <small>{{ card.subtitle }}</small>
                </span>
                <button type="button" class="play" (click)="openVideo(card.name)" aria-label="Смотреть видео">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </button>
              </div>
              <div class="queue-actions">
                <button type="button" class="outline" (click)="openVideo(card.name)">Смотреть</button>
                <button type="button" class="fill" (click)="reply(card.name)">Ответить</button>
              </div>
            </article>
          }
          @case ('question') {
            <a class="queue-card queue-card--question queue-row" href="#chat" (click)="reply(card.name)">
              <span class="icon icon--blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 9a3 3 0 1 1 4 2.8c-.8.3-1.1 1-1.1 1.7v.5M12 17h.01" /></svg>
              </span>
              <span class="queue-body">
                <strong>{{ card.name }}</strong>
                <small>{{ card.subtitle }}</small>
              </span>
              <span class="chevron">›</span>
            </a>
          }
          @case ('risk') {
            <article class="queue-card queue-card--risk">
              <div class="queue-row">
                <span class="icon icon--copper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>
                </span>
                <span class="queue-body">
                  <strong>{{ card.name }}</strong>
                  <small class="risk-text">{{ card.subtitle }}</small>
                </span>
              </div>
              <button type="button" class="outline outline--block" (click)="reply(card.name)">Написать</button>
            </article>
          }
        }
      }
    </ng-template>

    <div class="screen mobile-only">
      <header class="app-header">
        <div class="brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
          <span>toptrainers</span>
          <span class="pro-badge">PRO</span>
        </div>
        <button type="button" class="bell" aria-label="Уведомления">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <span class="bell-badge">7</span>
        </button>
      </header>

      <section class="summary">
        <p class="summary-title">СВОДКА ДНЯ</p>
        <div class="summary-grid">
          <div><span class="summary-value summary-value--lime">84<i>т₽</i></span><small>выручка</small></div>
          <div><span class="summary-value">12</span><small>продлений</small></div>
          <div><span class="summary-value summary-value--copper">2</span><small>риск оттока</small></div>
        </div>
      </section>

      <section class="queue">
        <div class="queue-head">
          <span>ОБРАБОТАТЬ <i>({{ queue.length }})</i></span>
          <span class="queue-hint">← отложить · ответить →</span>
        </div>
        <div class="queue-list"><ng-container *ngTemplateOutlet="queueCards" /></div>
        @if (message()) {
          <p class="form-message">{{ message() }}</p>
        }
      </section>

      <nav class="tabbar" aria-label="Навигация">
        <a class="tab is-active" routerLink="/trainer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
          <span>Сегодня</span>
        </a>
        <a class="tab" href="#clients">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg>
          <span>Клиенты</span>
        </a>
        <a class="tab" routerLink="/trainer/programs">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg>
          <span>Программы</span>
        </a>
        <a class="tab" href="#chats">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg>
          <span>Чаты</span>
        </a>
        <a class="tab" href="#more">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          <span>Ещё</span>
        </a>
      </nav>
    </div>

    <div class="desktop-shell desktop-only">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
        </div>
        <nav class="sidebar-nav" aria-label="Навигация">
          <a class="side-item is-active" routerLink="/trainer">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg></span>
            <span>Сегодня</span>
          </a>
          <a class="side-item" href="#clients">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg></span>
            <span>Клиенты</span>
          </a>
          <a class="side-item" routerLink="/trainer/programs">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg></span>
            <span>Программы</span>
          </a>
          <a class="side-item" href="#chats">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg></span>
            <span>Чаты</span>
          </a>
          <a class="side-item" href="#competitions">
            <span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg></span>
            <span>Соревн.</span>
          </a>
        </nav>
        <span class="sidebar-avatar"></span>
      </aside>

      <div class="col col-queue">
        <p class="col-title">ОБРАБОТАТЬ <i>({{ queue.length }})</i></p>
        <div class="queue-list"><ng-container *ngTemplateOutlet="queueCards" /></div>
      </div>

      <div class="col col-feed">
        <p class="col-title">ЛЕНТА СОБЫТИЙ</p>
        <div class="feed-list">
          @for (event of feed; track event.time + event.name) {
            <div class="feed-row">
              <span class="feed-dot" [attr.data-dot]="event.dot"></span>
              <div class="feed-body">
                <p><b>{{ event.name }}</b> {{ event.text }}</p>
                <span class="feed-time">{{ event.time }}</span>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="col col-summary">
        <p class="col-title">СВОДКА · ТАБЛО</p>
        <div class="revenue-card">
          <p class="micro-label">ВЫРУЧКА СЕГОДНЯ</p>
          <p class="revenue-value">84<span>т₽</span></p>
          <div class="revenue-stats">
            <div><b>12</b><small>продлений</small></div>
            <div><b class="copper">2</b><small>риск оттока</small></div>
          </div>
        </div>
        <div class="metric-card">
          <p class="micro-label">АКТИВНЫХ КЛИЕНТОВ</p>
          <p class="metric-row"><span class="metric-big">48</span><span class="metric-delta">+3 за неделю</span></p>
        </div>
        <div class="metric-card">
          <p class="micro-label">СРЕДНЕЕ ВЫПОЛНЕНИЕ</p>
          <div class="completion-bar">
            @for (segment of completionSegments; track $index) {
              <span [class.is-filled]="segment"></span>
            }
          </div>
          <p class="metric-big">82%</p>
        </div>
        @if (message()) {
          <p class="form-message">{{ message() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .mobile-only { display: block; }
    .desktop-only { display: none; }
    .screen { min-height: 100dvh; padding-bottom: 5.5rem; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .app-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem 0.75rem; }
    .brand { display: inline-flex; align-items: center; gap: 0.4375rem; color: #c9f24b; }
    .brand span:not(.pro-badge) { font-weight: 700; font-size: 0.9375rem; color: #f5f7fa; }
    .pro-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.5625rem;
      font-weight: 700;
      color: #c9f24b;
      background: rgb(201 242 75 / 12%);
      padding: 0.125rem 0.375rem;
      border-radius: 999px;
    }
    .bell {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.125rem;
      height: 2.125rem;
      border: 0;
      border-radius: 999px;
      background: #1c222b;
      color: #8a94a6;
      cursor: pointer;
    }
    .bell-badge {
      position: absolute;
      top: -0.125rem;
      right: -0.125rem;
      width: 1rem;
      height: 1rem;
      border-radius: 999px;
      background: #ff4d5e;
      color: #fff;
      font-size: 0.5625rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #14181d;
    }
    .summary { margin: 0 1.25rem 0.375rem; padding: 1rem 1.125rem; background: #1c222b; border-radius: 1rem; }
    .summary-title { margin: 0 0 0.75rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #8a94a6; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.625rem; }
    .summary-value { display: block; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.5rem; color: #f5f7fa; line-height: 1; }
    .summary-value--lime { color: #c9f24b; }
    .summary-value--copper { color: #e8833a; }
    .summary-value i { font-style: normal; font-size: 0.8125rem; color: #8a94a6; }
    .summary-grid small { display: block; margin-top: 0.3125rem; font-size: 0.6875rem; color: #8a94a6; }
    .queue { padding: 0.875rem 1.25rem 0.5rem; }
    .queue-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .queue-head > span:first-child { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; letter-spacing: 0.1em; color: #f5f7fa; font-weight: 700; }
    .queue-head i, .col-title i { font-style: normal; color: #e8833a; }
    .queue-hint { font-size: 0.6875rem; color: #8a94a6; }
    .queue-list { display: flex; flex-direction: column; gap: 0.625rem; }
    .queue-card { background: #1c222b; border-radius: 1rem; padding: 1rem; border: 0; border-left: 3px solid transparent; text-decoration: none; color: inherit; display: block; width: 100%; text-align: left; }
    .queue-card--video { border-left-color: #c9f24b; }
    .queue-card--question { border-left-color: #2f5cff; }
    .queue-card--risk { border-left-color: #e8833a; }
    .queue-row { display: flex; align-items: center; gap: 0.625rem; }
    .avatar {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 999px;
      flex-shrink: 0;
      background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px);
    }
    .icon { display: flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; flex-shrink: 0; }
    .icon--blue { background: rgb(47 92 255 / 14%); color: #2f5cff; }
    .icon--copper { background: rgb(232 131 58 / 14%); color: #e8833a; }
    .queue-body { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
    .queue-body strong { font-weight: 600; font-size: 0.875rem; color: #f5f7fa; }
    .queue-body small { font-size: 0.71875rem; color: #8a94a6; }
    .risk-text { color: #e8833a; }
    .chevron { color: #8a94a6; }
    .play {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: 0.625rem;
      background: rgb(201 242 75 / 12%);
      color: #c9f24b;
      cursor: pointer;
      flex-shrink: 0;
    }
    .queue-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
    .outline, .fill {
      flex: 1;
      text-align: center;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.5625rem;
      border-radius: 0.5625rem;
      border: 1px solid rgb(245 247 250 / 16%);
      background: transparent;
      color: #f5f7fa;
      cursor: pointer;
    }
    .fill { border: 0; font-weight: 700; color: #14181d; background: #c9f24b; }
    .outline--block { display: block; width: 100%; margin-top: 0.75rem; }
    .form-message { font-size: 0.8125rem; color: #8a94a6; margin: 0.75rem 0 0; text-align: center; }
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

    .desktop-shell {
      min-height: 100dvh;
      background: #14181d;
      color: #f5f7fa;
      font-family: 'Golos Text', system-ui, sans-serif;
    }
    .sidebar {
      width: 5.5rem;
      background: #0e1116;
      border-right: 1px solid rgb(245 247 250 / 6%);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem 0;
      gap: 1.625rem;
    }
    .sidebar-logo { color: #c9f24b; }
    .sidebar-nav { display: flex; flex-direction: column; align-items: center; gap: 1.375rem; margin-top: 0.5rem; }
    .side-item { display: flex; flex-direction: column; align-items: center; gap: 0.3125rem; color: #8a94a6; text-decoration: none; font-size: 0.5625rem; }
    .side-icon { display: flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; }
    .side-item.is-active { color: #c9f24b; font-weight: 600; }
    .side-item.is-active .side-icon { background: rgb(201 242 75 / 12%); }
    .sidebar-avatar {
      margin-top: auto;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px);
    }
    .col { padding: 1.625rem 1.75rem; overflow-y: auto; }
    .col-title { margin: 0 0 0.875rem; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; letter-spacing: 0.1em; color: #f5f7fa; font-weight: 700; }
    .col-queue { width: 25rem; border-right: 1px solid rgb(245 247 250 / 6%); flex-shrink: 0; }
    .col-feed { flex: 1; border-right: 1px solid rgb(245 247 250 / 6%); }
    .col-summary { width: 21.25rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 1.25rem; }
    .feed-list { display: flex; flex-direction: column; }
    .feed-row { display: flex; gap: 0.875rem; padding: 1rem 0; border-top: 1px solid rgb(245 247 250 / 6%); }
    .feed-row:first-child { border-top: 0; }
    .feed-dot { width: 0.5rem; height: 0.5rem; border-radius: 999px; margin-top: 0.375rem; flex-shrink: 0; }
    .feed-dot[data-dot='lime'] { background: #c9f24b; }
    .feed-dot[data-dot='blue'] { background: #2f5cff; }
    .feed-dot[data-dot='gold'] { background: #e7b54a; }
    .feed-dot[data-dot='red'] { background: #ff4d5e; }
    .feed-body p { margin: 0; font-size: 0.875rem; color: #f5f7fa; }
    .feed-time { display: block; margin-top: 0.1875rem; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
    .micro-label { margin: 0 0 0.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; }
    .revenue-card, .metric-card { background: #1c222b; border-radius: 1rem; padding: 1.25rem; }
    .revenue-value { margin: 0; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 2.75rem; color: #c9f24b; line-height: 1; }
    .revenue-value span { font-size: 1.25rem; color: #8a94a6; }
    .revenue-stats { display: flex; gap: 1.25rem; margin-top: 1.25rem; }
    .revenue-stats b { display: block; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.5rem; color: #f5f7fa; line-height: 1; }
    .revenue-stats b.copper { color: #e8833a; }
    .revenue-stats small { display: block; margin-top: 0.25rem; font-size: 0.6875rem; color: #8a94a6; }
    .metric-row { display: flex; align-items: baseline; gap: 0.5rem; margin: 0; }
    .metric-big { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.875rem; color: #f5f7fa; }
    .metric-delta { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #c9f24b; }
    .completion-bar { display: flex; gap: 0.3125rem; align-items: center; margin-top: 0.5rem; }
    .completion-bar span { flex: 1; height: 1.625rem; border-radius: 0.375rem; background: rgb(245 247 250 / 8%); }
    .completion-bar span.is-filled { background: #c9f24b; }
    .col-summary .metric-big { margin-top: 0.75rem; display: block; }

    @media (min-width: 720px) and (max-width: 1079.98px) {
      .screen { max-width: 30rem; margin: 0 auto; }
    }
    @media (min-width: 1080px) {
      .mobile-only { display: none; }
      .desktop-only { display: flex; }
      .desktop-shell { display: flex; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerTodayComponent {
  protected readonly queue = QUEUE;
  protected readonly feed = FEED;
  protected readonly completionSegments = [true, true, true, true, false];
  protected readonly message = signal('');

  protected openVideo(name: string): void {
    this.message.set(`Просмотр видеоотчёта ${name} появится вместе с загрузкой медиа.`);
  }

  protected reply(name: string): void {
    this.message.set(`Чат с ${name} появится вместе с модулем сообщений.`);
  }
}
