import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import { WeekRibbonComponent, type WeekDay } from '@toptrainers/ui';

const TRAINER_WEEK: readonly WeekDay[] = [
  { isoDate: '2026-07-13', shortLabel: 'Пн', dateLabel: '13', state: 'done' },
  { isoDate: '2026-07-14', shortLabel: 'Вт', dateLabel: '14', state: 'done' },
  { isoDate: '2026-07-15', shortLabel: 'Ср', dateLabel: '15', state: 'idle' },
  { isoDate: '2026-07-16', shortLabel: 'Чт', dateLabel: '16', state: 'today' },
  { isoDate: '2026-07-17', shortLabel: 'Пт', dateLabel: '17', state: 'idle' },
  { isoDate: '2026-07-18', shortLabel: 'Сб', dateLabel: '18', state: 'idle' },
  { isoDate: '2026-07-19', shortLabel: 'Вс', dateLabel: '19', state: 'idle' },
];

interface Program { id: string; title: string; weeks: number; }

@Component({
  selector: 'tt-trainer-home',
  standalone: true,
  imports: [FormsModule, RouterLink, WeekRibbonComponent],
  template: `
    <section class="page-heading"><div><p class="eyebrow">Рабочее пространство</p><h1>Добрый день, тренер</h1><p>Создайте программу, опубликуйте витрину и пригласите клиента.</p></div><a class="button button--primary" href="#programs">Создать программу</a></section>
    <section class="card"><div class="card__header"><div><p class="eyebrow">Назначения</p><h2>Неделя клиентов</h2></div><a routerLink="/client">Открыть клиентский вид</a></div><tt-week-ribbon [days]="week" /></section>
    @if (!hasToken()) {
      <section class="card"><h2>Доступ тренера</h2><p>Войдите или создайте аккаунт тренера, чтобы сохранять программы.</p><a class="button button--primary" routerLink="/auth">Войти или зарегистрироваться</a></section>
    }
    <section id="programs" class="card"><div class="card__header"><h2>Программы</h2><a routerLink="/trainer/programs/builder">Открыть конструктор</a></div><p>Первый рабочий срез сохраняет программу в PostgreSQL.</p>
      <form class="program-form" (ngSubmit)="createProgram()"><label>Название<input name="title" [(ngModel)]="title" required maxlength="160" /></label><label>Описание<textarea name="description" [(ngModel)]="description" maxlength="2000"></textarea></label><label>Недель<input name="weeks" type="number" min="1" max="52" [(ngModel)]="weeks" /></label><button class="button button--primary" type="submit" [disabled]="busy()">{{ busy() ? 'Сохраняем…' : 'Сохранить программу' }}</button></form>
      @if (message()) { <p class="form-message">{{ message() }}</p> } @if (programs().length) { <ul class="program-list">@for (program of programs(); track program.id) { <li><strong>{{ program.title }}</strong><span>{{ program.weeks }} нед.</span></li>}</ul> }
    </section>
  `,
  styles: `:host{display:grid;gap:1rem;width:min(100%,72rem);margin:0 auto;padding:clamp(1rem,4vw,2rem)}.page-heading,.card__header{display:flex;gap:1rem;align-items:start;justify-content:space-between}.page-heading{padding:1rem 0}h1,h2,p{margin-top:0}h1{margin-bottom:.4rem;font-size:clamp(1.8rem,5vw,2.75rem)}h2{margin-bottom:0;font-size:1.25rem}.eyebrow{margin-bottom:.25rem;color:#486581;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.card{padding:clamp(1rem,3vw,1.5rem);border:1px solid var(--tt-line,#dce4ee);border-radius:1rem;background:#fff;box-shadow:0 .5rem 1.5rem rgb(16 42 67 / 6%)}.card__header{margin-bottom:1rem}.card__header a{color:#1677ff}.button{display:inline-flex;min-height:2.75rem;align-items:center;padding:0 1rem;border:0;border-radius:.625rem;text-decoration:none;white-space:nowrap;font:inherit;cursor:pointer}.button--primary{background:#1677ff;color:#fff}.button--secondary{background:#eaf2ff;color:#125bb3}.program-form{display:grid;gap:.75rem;max-width:36rem;margin-top:1rem}label{display:grid;gap:.3rem;color:#334e68;font-size:.9rem;font-weight:600}input,textarea{width:100%;box-sizing:border-box;padding:.7rem;border:1px solid #bcccdc;border-radius:.5rem;font:inherit}textarea{min-height:5rem;resize:vertical}.auth-actions{display:flex;gap:.5rem;flex-wrap:wrap}.form-message{color:#1677ff}.program-list{display:grid;gap:.5rem;padding:0;list-style:none}.program-list li{display:flex;justify-content:space-between;padding:.75rem;border:1px solid #dce4ee;border-radius:.5rem}@media(max-width:38rem){.page-heading,.card__header{flex-direction:column}}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerHomeComponent {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);
  protected readonly week = TRAINER_WEEK;
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly programs = signal<Program[]>([]);
  protected readonly hasToken = signal(false);
  protected title = '';
  protected description = '';
  protected weeks = 4;

  constructor() {
    this.http.get(`${this.config.apiBaseUrl}/auth/session`).subscribe({
      next: () => this.hasToken.set(true),
      error: () => this.hasToken.set(false),
    });
  }

  protected createProgram(): void {
    this.busy.set(true);
    this.message.set('');
    this.http.post<Program>(`${this.config.apiBaseUrl}/programs`, { title: this.title, description: this.description, weeks: this.weeks }).subscribe({
      next: (program) => { this.programs.update((items) => [...items, program]); this.message.set('Программа создана'); this.title = ''; this.description = ''; },
      error: () => { this.message.set('Нужна авторизация тренера — войдите или зарегистрируйтесь на /auth.'); this.busy.set(false); },
      complete: () => this.busy.set(false),
    });
  }
}
