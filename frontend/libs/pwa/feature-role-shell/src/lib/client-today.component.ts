import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WeekRibbonComponent, type WeekDay } from '@toptrainers/ui';

const CLIENT_WEEK: readonly WeekDay[] = [
  { isoDate: '2026-07-13', shortLabel: 'Пн', dateLabel: '13', state: 'done' },
  { isoDate: '2026-07-14', shortLabel: 'Вт', dateLabel: '14', state: 'done' },
  { isoDate: '2026-07-15', shortLabel: 'Ср', dateLabel: '15', state: 'idle' },
  { isoDate: '2026-07-16', shortLabel: 'Чт', dateLabel: '16', state: 'today' },
  { isoDate: '2026-07-17', shortLabel: 'Пт', dateLabel: '17', state: 'idle' },
  { isoDate: '2026-07-18', shortLabel: 'Сб', dateLabel: '18', state: 'idle' },
  { isoDate: '2026-07-19', shortLabel: 'Вс', dateLabel: '19', state: 'idle' },
];

@Component({
  selector: 'tt-client-today',
  standalone: true,
  imports: [RouterLink, WeekRibbonComponent],
  template: `
    <section class="hero">
      <p class="eyebrow">Сегодня</p>
      <h1>Силовая тренировка A</h1>
      <p>3 упражнения · примерно 45 минут · программа «База 3×4»</p>
      <button type="button">Начать тренировку</button>
    </section>

    <section class="card" aria-labelledby="week-title">
      <div class="card__header">
        <h2 id="week-title">Твоя неделя</h2>
        <a routerLink="/trainer">Вернуться к тренеру</a>
      </div>
      <tt-week-ribbon [days]="week" />
    </section>

    <p class="offline-note">
      Статус офлайна и очередь синхронизации подключаются отдельным PWA-блоком после появления
      API назначений.
    </p>
  `,
  styles: `
    :host { display: grid; gap: 1rem; }
    .hero, .card { padding: clamp(1rem, 3vw, 1.5rem); border-radius: 1rem; }
    .hero { background: linear-gradient(135deg, #0d2235, #17456d); color: #fff; }
    .hero h1 { margin: 0.25rem 0 0.5rem; font-size: clamp(1.8rem, 5vw, 2.75rem); }
    .hero p:last-of-type { color: rgb(255 255 255 / 75%); }
    .eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    button { min-height: 2.75rem; padding: 0 1rem; border: 0; border-radius: 0.625rem; background: #1eb980; color: #0d2235; font: inherit; font-weight: 700; cursor: pointer; }
    .card { border: 1px solid var(--tt-line, #dce4ee); background: #fff; box-shadow: 0 0.5rem 1.5rem rgb(16 42 67 / 6%); }
    .card__header { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .card__header h2 { margin: 0; font-size: 1.25rem; }
    .card__header a { color: var(--tt-blue, #1677ff); }
    .offline-note { margin: 0; color: #627d98; font-size: 0.875rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientTodayComponent {
  protected readonly week = CLIENT_WEEK;
}
