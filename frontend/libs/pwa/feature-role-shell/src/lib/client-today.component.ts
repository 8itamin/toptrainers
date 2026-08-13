import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type DayState = 'done' | 'idle' | 'missed' | 'future';

interface WeekCell {
  label: string;
  state: DayState;
}

const WEEK: readonly WeekCell[] = [
  { label: 'ПН', state: 'done' },
  { label: 'ВТ', state: 'done' },
  { label: 'СР', state: 'idle' },
  { label: 'ЧТ', state: 'done' },
  { label: 'ПТ', state: 'done' },
  { label: 'СБ', state: 'missed' },
  { label: 'ВС', state: 'future' },
];

@Component({
  selector: 'tt-client-today',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="app-header">
        <a class="brand" routerLink="/client" aria-label="TopTrainers — Сегодня">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
          <span>toptrainers</span>
        </a>
        <div class="header-actions">
          <span class="streak">🔥 12</span>
          <button type="button" class="bell" aria-label="Уведомления">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </button>
        </div>
      </header>

      <section class="ribbon" aria-label="Лента недели">
        <div class="ribbon-head">
          <span>ЛЕНТА НЕДЕЛИ</span>
          <span>4 из 6</span>
        </div>
        <div class="ribbon-track">
          @for (day of week; track day.label) {
            <span class="ribbon-cell" [attr.data-state]="day.state"></span>
          }
        </div>
        <div class="ribbon-labels">
          @for (day of week; track day.label) {
            <span>{{ day.label }}</span>
          }
        </div>
      </section>

      <section class="hero">
        <div class="hero-top">
          <div>
            <p class="eyebrow">СЕГОДНЯ · ТРЕНИРОВКА</p>
            <h1>Ноги + кор</h1>
            <p class="meta">6 упражнений · ~55 мин</p>
          </div>
          <div class="hero-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M6.5 6.5v11M17.5 6.5v11" /></svg>
          </div>
        </div>
        <a class="cta" routerLink="/client/workout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Начать тренировку
        </a>
      </section>

      <section class="widgets">
        <a class="widget" href="#measurements">
          <span class="widget-icon widget-icon--blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>
          </span>
          <span class="widget-body">
            <strong>Внеси замер</strong>
            <small>Вес тела · пора обновить</small>
          </span>
          <span class="widget-arrow">›</span>
        </a>
        <a class="widget" href="#club-cup">
          <span class="widget-icon widget-icon--gold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg>
          </span>
          <span class="widget-body">
            <strong>Кубок клуба</strong>
            <small>Ты 4-й из 27</small>
          </span>
          <span class="widget-arrow widget-arrow--gold">→</span>
        </a>
        <div class="widget widget--quote">
          <span class="avatar"></span>
          <span class="widget-body">
            <strong>Тренер · Антон</strong>
            <small>«Видео приседа — 👍 техника чистая»</small>
          </span>
        </div>
      </section>

      <nav class="tabbar" aria-label="Навигация">
        <a class="tab is-active" routerLink="/client">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
          <span>Сегодня</span>
        </a>
        <a class="tab" href="#calendar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
          <span>Календарь</span>
        </a>
        <a class="tab" href="#progress">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18M7 14l3-3 3 3 5-6" /></svg>
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
    .screen {
      min-height: 100dvh;
      padding-bottom: 5.5rem;
      background: #14181d;
      color: #f5f7fa;
      font-family: 'Golos Text', system-ui, sans-serif;
    }
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0.75rem;
    }
    .brand { display: inline-flex; align-items: center; gap: 0.4375rem; color: #c9f24b; text-decoration: none; }
    .brand span { font-weight: 700; font-size: 0.9375rem; color: #f5f7fa; }
    .header-actions { display: flex; align-items: center; gap: 0.625rem; }
    .streak {
      display: inline-flex;
      align-items: center;
      gap: 0.3125rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 0.8125rem;
      color: #e8833a;
      background: rgb(232 131 58 / 12%);
      padding: 0.3125rem 0.625rem;
      border-radius: 999px;
    }
    .bell {
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
    .ribbon { padding: 0.375rem 1.25rem 1.125rem; }
    .ribbon-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5625rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem;
      letter-spacing: 0.12em;
      color: #8a94a6;
    }
    .ribbon-track { display: flex; gap: 0.3125rem; align-items: center; }
    .ribbon-cell { flex: 1; height: 0.75rem; border-radius: 999px; background: rgb(245 247 250 / 9%); }
    .ribbon-cell[data-state='done'] { background: #c9f24b; }
    .ribbon-cell[data-state='missed'] { background: rgb(255 77 94 / 35%); }
    .ribbon-cell[data-state='future'] { background: transparent; border: 1.5px dashed rgb(245 247 250 / 22%); }
    .ribbon-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 0.4375rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.5625rem;
      color: #5b6472;
    }
    .hero {
      margin: 0 1.25rem;
      padding: 1.375rem;
      background: #1c222b;
      border: 1px solid rgb(245 247 250 / 6%);
      border-radius: 1.125rem;
    }
    .hero-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .eyebrow { margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #c9f24b; }
    .hero h1 { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.5rem; color: #f5f7fa; margin: 0.5rem 0 0; line-height: 1.1; }
    .meta { margin: 0.375rem 0 0; font-size: 0.8125rem; color: #8a94a6; }
    .hero-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3.25rem;
      height: 3.25rem;
      border-radius: 0.875rem;
      background: rgb(201 242 75 / 12%);
      color: #c9f24b;
      flex-shrink: 0;
    }
    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 3.5rem;
      margin-top: 1.25rem;
      border-radius: 0.75rem;
      background: #c9f24b;
      color: #14181d;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
    }
    .widgets { padding: 1rem 1.25rem 0.5rem; display: flex; flex-direction: column; gap: 0.625rem; }
    .widget {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #1c222b;
      border-radius: 0.875rem;
      padding: 0.875rem 1rem;
      color: inherit;
      text-decoration: none;
    }
    .widget--quote { align-items: flex-start; }
    .widget-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.6875rem;
      flex-shrink: 0;
    }
    .widget-icon--blue { background: rgb(47 92 255 / 14%); color: #2f5cff; }
    .widget-icon--gold { background: rgb(231 181 74 / 16%); color: #e7b54a; }
    .widget-body { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; }
    .widget-body strong { font-weight: 600; font-size: 0.875rem; color: #f5f7fa; }
    .widget-body small { font-size: 0.75rem; color: #8a94a6; line-height: 1.4; }
    .widget-arrow { color: #8a94a6; }
    .widget-arrow--gold { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #e7b54a; }
    .avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      flex-shrink: 0;
      background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px);
    }
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
    .tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      color: #5b6472;
      text-decoration: none;
      font-size: 0.625rem;
    }
    .tab.is-active { color: #c9f24b; font-weight: 600; }
    @media (min-width: 720px) {
      .screen { max-width: 30rem; margin: 0 auto; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientTodayComponent {
  protected readonly week = WEEK;
}
