import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ExerciseState = 'done' | 'current' | 'upcoming';

interface WorkoutExercise {
  code: string;
  name: string;
  details: readonly string[];
  state: ExerciseState;
}

interface WorkoutBlock {
  label: string;
  exercises: readonly WorkoutExercise[];
}

const WORKOUT_BLOCKS: readonly WorkoutBlock[] = [
  {
    label: 'БЛОК A · СИЛА',
    exercises: [
      { code: '✓', name: 'Разминка · велотренажёр', details: ['10 мин · выполнено'], state: 'done' },
      { code: '✓', name: 'Гиперэкстензия', details: ['3 × 15 · выполнено'], state: 'done' },
      { code: 'A1', name: 'Присед со штангой', details: ['4 × 8', '80 кг'], state: 'current' },
      { code: 'A2', name: 'Жим ногами', details: ['3 × 12', '120 кг'], state: 'upcoming' },
    ],
  },
  {
    label: 'БЛОК B · ОБЪЁМ',
    exercises: [
      { code: 'B1', name: 'Выпады с гантелями', details: ['3 × 10 / нога'], state: 'upcoming' },
      { code: 'B2', name: 'Планка + скручивания', details: ['3 × 45 с'], state: 'upcoming' },
    ],
  },
];

@Component({
  selector: 'tt-client-workout-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="screen">
      <header class="app-header">
        <a class="back" routerLink="/client" aria-label="Вернуться к экрану Сегодня">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Сегодня
        </a>
        <span class="streak">🔥 12</span>
      </header>

      <section class="workout-heading" aria-labelledby="workout-title">
        <p>ТРЕНИРОВКА ДНЯ</p>
        <h1 id="workout-title">Ноги + кор</h1>
        <div class="workout-meta">
          <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6" /></svg>6 упражнений</span>
          <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>~55 мин</span>
        </div>
        <div class="progress" aria-label="Выполнено 2 из 6 упражнений">
          <span><i></i></span>
          <b>2/6</b>
        </div>
      </section>

      <section class="exercise-list" aria-label="Упражнения тренировки">
        @for (block of blocks; track block.label) {
          <h2>{{ block.label }}</h2>
          @for (exercise of block.exercises; track exercise.code + exercise.name) {
            @if (exercise.state === 'done') {
              <article class="exercise exercise--done">
                <span class="exercise-media exercise-media--done" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <span class="exercise-copy">
                  <strong>{{ exercise.name }}</strong>
                  <small>{{ exercise.details[0] }}</small>
                </span>
              </article>
            } @else {
              <a class="exercise" [class.exercise--current]="exercise.state === 'current'" routerLink="/client/workout/player">
                <span class="exercise-media" [attr.data-code]="exercise.code" aria-hidden="true"></span>
                <span class="exercise-copy">
                  <strong>{{ exercise.name }}</strong>
                  <small class="chips">
                    @for (detail of exercise.details; track detail) {
                      <i [class.chip--lime]="detail.includes('кг')">{{ detail }}</i>
                    }
                  </small>
                </span>
                @if (exercise.state === 'current') {
                  <span class="play" aria-label="Продолжить упражнение"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
                } @else {
                  <span class="chevron" aria-hidden="true">›</span>
                }
              </a>
            }
          }
        }
      </section>

      <footer class="action-bar">
        <a class="cta" routerLink="/client/workout/player">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Продолжить · присед
        </a>
      </footer>

      <nav class="tabbar" aria-label="Навигация клиента">
        <a class="tab" routerLink="/client"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg><span>Сегодня</span></a>
        <a class="tab" href="#calendar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg><span>Календарь</span></a>
        <a class="tab is-active" routerLink="/client/workout"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Тренировка</span></a>
        <a class="tab" href="#competitions"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg><span>Соревн.</span></a>
        <a class="tab" href="#profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg><span>Профиль</span></a>
      </nav>
    </main>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; padding-bottom: calc(10.5rem + env(safe-area-inset-bottom)); background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .app-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem 0.75rem; }
    .back { display: inline-flex; align-items: center; gap: .375rem; color: #8a94a6; font-size: .875rem; text-decoration: none; }
    .streak { display: inline-flex; align-items: center; gap: .3125rem; border-radius: 999px; padding: .3125rem .625rem; background: rgb(232 131 58 / 12%); color: #e8833a; font-family: 'JetBrains Mono', monospace; font-size: .8125rem; font-weight: 700; }
    .workout-heading { padding: .125rem 1.25rem 1rem; }
    .workout-heading p, .exercise-list h2 { margin: 0; color: #c9f24b; font-family: 'JetBrains Mono', monospace; font-size: .625rem; letter-spacing: .12em; }
    .workout-heading h1 { margin: .5rem 0 0; color: #f5f7fa; font-family: 'Unbounded', sans-serif; font-size: 1.625rem; font-weight: 600; letter-spacing: -.04em; line-height: 1.12; }
    .workout-meta { display: flex; gap: .875rem; margin-top: .5rem; color: #8a94a6; font-size: .8125rem; }
    .workout-meta span { display: inline-flex; align-items: center; gap: .3125rem; }
    .progress { display: flex; align-items: center; gap: .625rem; margin-top: .875rem; }
    .progress span { height: .5rem; flex: 1; overflow: hidden; border-radius: 999px; background: rgb(245 247 250 / 9%); }
    .progress i { display: block; width: 33.333%; height: 100%; border-radius: inherit; background: #c9f24b; }
    .progress b { color: #8a94a6; font-family: 'JetBrains Mono', monospace; font-size: .6875rem; font-weight: 500; }
    .exercise-list { display: flex; flex-direction: column; gap: .625rem; padding: .125rem 1.25rem 1rem; }
    .exercise-list h2 { margin: .375rem 0 .0625rem; color: #8a94a6; }
    .exercise { display: flex; align-items: center; gap: .8125rem; min-height: 4.25rem; padding: .75rem .875rem; border: 1px solid transparent; border-radius: .875rem; background: #1c222b; color: inherit; text-decoration: none; }
    .exercise--current { border-color: #c9f24b; }
    .exercise--done { opacity: .7; }
    .exercise-media { position: relative; display: grid; width: 2.75rem; height: 2.75rem; flex: 0 0 auto; place-items: center; border-radius: .6875rem; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }
    .exercise-media::after { content: attr(data-code); position: absolute; top: .25rem; left: .25rem; color: #8a94a6; font-family: 'JetBrains Mono', monospace; font-size: .5rem; }
    .exercise--current .exercise-media::after { color: #c9f24b; }
    .exercise-media--done { background: rgb(201 242 75 / 12%); color: #c9f24b; }
    .exercise-media--done::after { content: none; }
    .exercise-copy { min-width: 0; flex: 1; }
    .exercise-copy strong { display: block; overflow: hidden; color: #f5f7fa; font-size: .9375rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .exercise--done strong { text-decoration: line-through; text-decoration-color: rgb(245 247 250 / 40%); }
    .exercise-copy small { display: block; margin-top: .1875rem; color: #8a94a6; font-family: 'JetBrains Mono', monospace; font-size: .6875rem; }
    .chips { display: flex !important; gap: .375rem; }
    .chips i { border-radius: .375rem; padding: .1875rem .5rem; background: #14181d; color: #f5f7fa; font-style: normal; }
    .chips .chip--lime { color: #c9f24b; }
    .play { display: grid; width: 2.375rem; height: 2.375rem; flex: 0 0 auto; place-items: center; border-radius: .625rem; background: #c9f24b; color: #14181d; }
    .chevron { color: #5b6472; font-size: 1.5rem; line-height: 1; }
    .action-bar { position: fixed; right: 0; bottom: calc(4.875rem + env(safe-area-inset-bottom)); left: 0; z-index: 1; padding: .875rem 1.25rem; border-top: 1px solid rgb(245 247 250 / 6%); background: #14181d; }
    .cta { display: flex; height: 3.5rem; align-items: center; justify-content: center; gap: .5rem; border-radius: .8125rem; background: #c9f24b; color: #14181d; font-size: 1rem; font-weight: 700; text-decoration: none; }
    .tabbar { position: fixed; z-index: 2; inset-inline: 0; bottom: 0; display: flex; justify-content: space-between; padding: .75rem 1.25rem calc(.75rem + env(safe-area-inset-bottom)); background: #14181d; border-top: 1px solid rgb(245 247 250 / 6%); }
    .tab { display: flex; flex-direction: column; align-items: center; gap: .25rem; color: #5b6472; text-decoration: none; font-size: .625rem; }.tab.is-active { color: #c9f24b; font-weight: 600; }
    @media (min-width: 720px) { .screen { max-width: 30rem; margin: 0 auto; } .action-bar,.tabbar { width: 30rem; right: auto; left: 50%; transform: translateX(-50%); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkoutListComponent {
  protected readonly blocks = WORKOUT_BLOCKS;
}
