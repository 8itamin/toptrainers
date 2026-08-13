import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const REST_SECONDS = 90;

@Component({
  selector: 'tt-workout-player',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="app-header">
        <a class="back" routerLink="/client/workout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Ноги + кор
        </a>
        <span class="counter">{{ exerciseIndex() }} / {{ exerciseTotal() }}</span>
      </header>

      <div class="media">
        <div class="media-placeholder">[ видео упражнения ]</div>
        <span class="media-badge">A1 · СИЛА</span>
      </div>

      <div class="body">
        <h1>Присед со штангой</h1>

        <div class="scoreboard">
          <div class="score-cell">
            <span class="score-label">ПОДХОД</span>
            <span class="score-value score-value--lime">{{ setIndex() }}<i>/{{ setTotal }}</i></span>
          </div>
          <div class="score-cell">
            <span class="score-label">ПОВТОРЫ</span>
            <span class="score-value">{{ reps() }}</span>
          </div>
          <div class="score-cell">
            <span class="score-label">ВЕС, КГ</span>
            <span class="score-value">{{ weightKg() }}</span>
          </div>
        </div>

        <div class="steppers">
          <div class="stepper">
            <button type="button" (click)="adjustReps(-1)" [disabled]="reps() <= 1" aria-label="Меньше повторов">−</button>
            <span>повт</span>
            <button type="button" (click)="adjustReps(1)" aria-label="Больше повторов">+</button>
          </div>
          <div class="stepper">
            <button type="button" (click)="adjustWeight(-2.5)" [disabled]="weightKg() <= 0" aria-label="Меньше веса">−</button>
            <span>кг</span>
            <button type="button" (click)="adjustWeight(2.5)" aria-label="Больше веса">+</button>
          </div>
        </div>

        <div class="rest" [class.is-active]="restActive()">
          <div class="rest-ring" [style.--progress]="restProgress()"><span>{{ restRemaining() }}</span></div>
          <div class="rest-copy">
            <strong>Отдых</strong>
            <small>{{ restActive() ? 'Виброзвонок в конце' : 'Запустится после подхода' }}</small>
          </div>
          <span class="rest-time">{{ restLabel() }}</span>
        </div>

        <div class="actions">
          <button type="button" class="cta" [disabled]="isComplete()" (click)="completeSet()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            {{ isComplete() ? 'Все подходы выполнены' : 'Подход выполнен' }}
          </button>
          <button type="button" class="ghost-danger" (click)="recordVideo()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7zM1 5h15v14H1z" /></svg>
            Записать видеоотчёт
          </button>
        </div>

        @if (message()) {
          <p class="form-message">{{ message() }}</p>
        }
      </div>
      <nav class="tabbar" aria-label="Навигация клиента">
        <a class="tab" routerLink="/client"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg><span>Сегодня</span></a>
        <a class="tab" href="#calendar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg><span>Календарь</span></a>
        <a class="tab is-active" routerLink="/client/workout"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Тренировка</span></a>
        <a class="tab" href="#competitions"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg><span>Соревн.</span></a>
        <a class="tab" href="#profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg><span>Профиль</span></a>
      </nav>
    </div>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; padding-bottom: 6rem; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .app-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem 0.5rem; }
    .back { display: inline-flex; align-items: center; gap: 0.375rem; color: #8a94a6; text-decoration: none; font-size: 0.875rem; }
    .counter { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #8a94a6; }
    .media { margin: 0 1.25rem; position: relative; border-radius: 1.125rem; overflow: hidden; border: 1px solid rgb(245 247 250 / 6%); }
    .media-placeholder {
      height: 13.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: repeating-linear-gradient(135deg, #1c222b, #1c222b 14px, #20272f 14px, #20272f 28px);
      color: #8a94a6;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
    }
    .media-badge {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem;
      letter-spacing: 0.1em;
      color: #f5f7fa;
      background: rgb(14 17 22 / 70%);
      padding: 0.3125rem 0.625rem;
      border-radius: 999px;
    }
    .body { padding: 1.25rem 1.25rem 0; }
    h1 { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.375rem; color: #f5f7fa; margin: 0; line-height: 1.1; }
    .scoreboard { display: flex; gap: 0.5rem; margin-top: 1rem; }
    .score-cell { flex: 1; background: #1c222b; border-radius: 0.75rem; padding: 0.875rem 0.625rem; text-align: center; }
    .score-label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; letter-spacing: 0.08em; }
    .score-value { display: block; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.625rem; color: #f5f7fa; line-height: 1; margin-top: 0.375rem; }
    .score-value--lime { color: #c9f24b; }
    .score-value i { font-style: normal; font-size: 0.875rem; color: #5b6472; }
    .steppers { display: flex; gap: 0.5rem; margin-top: 0.625rem; }
    .stepper {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1c222b;
      border-radius: 0.75rem;
      padding: 0.5rem 0.625rem;
    }
    .stepper span { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #8a94a6; }
    .stepper button {
      width: 2.125rem;
      height: 2.125rem;
      border: 0;
      border-radius: 0.5625rem;
      background: #2a323d;
      color: #f5f7fa;
      font-size: 1.25rem;
      font-weight: 600;
      cursor: pointer;
    }
    .stepper button:disabled { opacity: 0.4; cursor: default; }
    .rest {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      margin-top: 0.875rem;
      background: #1c222b;
      border-radius: 0.875rem;
      padding: 0.875rem 1rem;
    }
    .rest-ring {
      position: relative;
      width: 2.875rem;
      height: 2.875rem;
      border-radius: 999px;
      background: conic-gradient(#2f5cff calc(var(--progress, 0) * 1%), #2a323d 0);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.3s linear;
    }
    .rest-ring::before {
      content: '';
      position: absolute;
      inset: 3px;
      border-radius: 999px;
      background: #1c222b;
    }
    .rest-ring span {
      position: relative;
      z-index: 1;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 0.6875rem;
      color: #f5f7fa;
    }
    .rest:not(.is-active) .rest-ring { background: #2a323d; }
    .rest-copy { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; }
    .rest-copy strong { font-weight: 600; font-size: 0.875rem; color: #f5f7fa; }
    .rest-copy small { font-size: 0.75rem; color: #8a94a6; }
    .rest-time { font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; color: #2f5cff; }
    .actions { display: flex; flex-direction: column; gap: 0.625rem; margin-top: 1rem; }
    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 3.5rem;
      border: 0;
      border-radius: 0.75rem;
      background: #c9f24b;
      color: #14181d;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
    }
    .cta:disabled { opacity: 0.55; cursor: default; }
    .ghost-danger {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 3rem;
      border: 1px solid rgb(255 77 94 / 30%);
      border-radius: 0.75rem;
      background: transparent;
      color: #ff4d5e;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .form-message { font-size: 0.8125rem; color: #8a94a6; margin: 0.75rem 0 0; text-align: center; }
    .tabbar { position: fixed; z-index: 2; inset-inline: 0; bottom: 0; display: flex; justify-content: space-between; padding: .75rem 1.25rem calc(.75rem + env(safe-area-inset-bottom)); background: #14181d; border-top: 1px solid rgb(245 247 250 / 6%); }
    .tab { display: flex; flex-direction: column; align-items: center; gap: .25rem; color: #5b6472; text-decoration: none; font-size: .625rem; }.tab.is-active { color: #c9f24b; font-weight: 600; }
    @media (min-width: 720px) {
      .screen { max-width: 30rem; margin: 0 auto; }
      .tabbar { width: 30rem; right: auto; left: 50%; transform: translateX(-50%); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutPlayerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private intervalId: ReturnType<typeof setInterval> | undefined;

  protected readonly setTotal = 4;
  protected readonly exerciseIndex = signal(3);
  protected readonly exerciseTotal = signal(6);
  protected readonly setIndex = signal(2);
  protected readonly reps = signal(8);
  protected readonly weightKg = signal(80);
  protected readonly restActive = signal(false);
  protected readonly restSecondsLeft = signal(REST_SECONDS);
  protected readonly message = signal('');

  protected readonly isComplete = computed(() => this.setIndex() > this.setTotal);
  protected readonly restProgress = computed(() =>
    Math.round(((REST_SECONDS - this.restSecondsLeft()) / REST_SECONDS) * 100),
  );
  protected readonly restRemaining = computed(() => this.restSecondsLeft());
  protected readonly restLabel = computed(() => {
    const seconds = this.restSecondsLeft();
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopRestTimer());
  }

  protected adjustReps(delta: number): void {
    this.reps.update((value) => Math.max(1, Math.min(30, value + delta)));
  }

  protected adjustWeight(delta: number): void {
    this.weightKg.update((value) => Math.max(0, Math.min(300, value + delta)));
  }

  protected completeSet(): void {
    if (this.isComplete()) return;
    this.setIndex.update((value) => value + 1);
    if (this.isComplete()) {
      this.stopRestTimer();
      return;
    }
    this.startRestTimer();
  }

  protected recordVideo(): void {
    this.message.set('Видеоотчёт уйдёт тренеру, когда появится загрузка медиа.');
  }

  private startRestTimer(): void {
    this.stopRestTimer();
    this.restActive.set(true);
    this.restSecondsLeft.set(REST_SECONDS);
    this.intervalId = setInterval(() => {
      const next = this.restSecondsLeft() - 1;
      if (next <= 0) {
        this.restSecondsLeft.set(0);
        this.stopRestTimer();
        return;
      }
      this.restSecondsLeft.set(next);
    }, 1000);
  }

  private stopRestTimer(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.restActive.set(false);
  }
}
