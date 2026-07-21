import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { WeekDay } from './week-day';

@Component({
  selector: 'tt-week-ribbon',
  standalone: true,
  template: `
    <ol class="week-ribbon" aria-label="Неделя тренировок">
      @for (day of days; track day.isoDate) {
        <li
          class="week-ribbon__day"
          [attr.data-state]="day.state"
          [attr.aria-current]="day.state === 'today' ? 'date' : null"
        >
          <span>{{ day.shortLabel }}</span>
          <strong>{{ day.dateLabel }}</strong>
        </li>
      }
    </ol>
  `,
  styles: `
    .week-ribbon {
      display: grid;
      grid-template-columns: repeat(7, minmax(2.5rem, 1fr));
      gap: 0.375rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .week-ribbon__day {
      display: grid;
      gap: 0.2rem;
      min-height: 4.75rem;
      place-content: center;
      border: 1px solid var(--tt-line, #dce4ee);
      border-radius: 0.75rem;
      background: #fff;
      color: var(--tt-ink, #102a43);
      text-align: center;
    }

    .week-ribbon__day > span {
      color: #627d98;
      font-size: 0.75rem;
    }

    .week-ribbon__day[data-state='today'] {
      border-color: var(--tt-blue, #1677ff);
      box-shadow: inset 0 0 0 1px var(--tt-blue, #1677ff);
    }

    .week-ribbon__day[data-state='done'] {
      background: #eafaf3;
      border-color: #1eb980;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekRibbonComponent {
  @Input({ required: true }) public days: readonly WeekDay[] = [];
}
