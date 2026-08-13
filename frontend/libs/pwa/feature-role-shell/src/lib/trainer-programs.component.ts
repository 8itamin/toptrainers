import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';

type ExerciseDirection = 'speed' | 'strength' | 'agility' | 'cardio';
type VideoPlatform = 'rutube' | 'youtube' | 'vk';
type WorkoutBlockKind = 'warmup' | 'main' | 'cooldown';

interface Exercise {
  id: string;
  title: string;
  direction: ExerciseDirection;
  muscle_group: string;
  instruction: string;
  reference_url: string | null;
  video_platform: VideoPlatform | null;
  video_url: string | null;
  video_file_url: string | null;
  thumbnail_url: string | null;
}

interface WorkoutExerciseDraft {
  exerciseId: string;
  weightKg: number | null;
  sets: number;
  reps: number;
}

interface Workout {
  id: string;
  title: string;
  description: string;
  blocks: Array<{
    id: string;
    kind: WorkoutBlockKind;
    exercises: Array<{ id: string; exercise_id: string; weight_kg: number | null; sets: number; reps: number }>;
  }>;
}

const DIRECTION_LABELS: Record<ExerciseDirection, string> = {
  speed: 'Скорость',
  strength: 'Сила',
  agility: 'Ловкость',
  cardio: 'Кардио',
};

const BLOCK_LABELS: Record<WorkoutBlockKind, string> = {
  warmup: 'Разминка',
  main: 'Основное',
  cooldown: 'Заминка',
};

const BLOCK_KINDS: readonly WorkoutBlockKind[] = ['warmup', 'main', 'cooldown'];

@Component({
  selector: 'tt-trainer-programs',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="screen">
      <header class="toolbar">
        <div>
          <a class="back" routerLink="/trainer/programs">← Программы</a>
          <h1>Библиотека и тренировки</h1>
          <p>Создавайте упражнения, затем собирайте из них тренировку.</p>
        </div>
        <div class="tabs" role="tablist" aria-label="Управление программами">
          <button type="button" [class.is-active]="activeTab() === 'exercises'" (click)="activeTab.set('exercises')">Упражнения</button>
          <button type="button" [class.is-active]="activeTab() === 'workouts'" (click)="activeTab.set('workouts')">Тренировки</button>
        </div>
      </header>

      @if (message()) { <p class="message" [class.is-error]="isError()">{{ message() }}</p> }

      @if (activeTab() === 'exercises') {
        <div class="layout">
          <section class="panel form-panel">
            <p class="eyebrow">НОВОЕ УПРАЖНЕНИЕ</p>
            <h2>Карточка упражнения</h2>
            <form (ngSubmit)="createExercise()">
              <label>Название *<input name="exerciseTitle" [(ngModel)]="exerciseTitle" required maxlength="160" placeholder="Например, жим лёжа" /></label>
              <div class="fields">
                <label>Направление *
                  <select name="direction" [(ngModel)]="exerciseDirection">
                    @for (direction of directions; track direction) { <option [value]="direction">{{ directionLabels[direction] }}</option> }
                  </select>
                </label>
                <label>Группа мышц *
                  <input name="muscleGroup" [(ngModel)]="exerciseMuscleGroup" list="muscle-groups" required maxlength="64" placeholder="Бицепс" />
                  <datalist id="muscle-groups"><option value="Бицепс"></option><option value="Грудь"></option></datalist>
                </label>
              </div>
              <label>Инструкция<textarea name="instruction" [(ngModel)]="exerciseInstruction" maxlength="4000" placeholder="Техника, темп, важные детали"></textarea></label>
              <label>Ссылка на материал<input name="referenceUrl" [(ngModel)]="exerciseReferenceUrl" type="url" placeholder="https://…" /></label>
              <div class="fields">
                <label>Площадка видео
                  <select name="videoPlatform" [(ngModel)]="exerciseVideoPlatform">
                    <option value="">Нет</option><option value="rutube">Rutube</option><option value="youtube">YouTube</option><option value="vk">VK Видео</option>
                  </select>
                </label>
                <label>Ссылка на видео<input name="videoUrl" [(ngModel)]="exerciseVideoUrl" type="url" placeholder="https://…" /></label>
              </div>
              <label>Прямая ссылка на видео (если есть)<input name="videoFileUrl" [(ngModel)]="exerciseVideoFileUrl" type="url" placeholder="https://…" /></label>
              <label>Миниатюра — ссылка на фото<input name="thumbnailUrl" [(ngModel)]="exerciseThumbnailUrl" type="url" placeholder="https://…" /></label>
              <button class="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Сохраняем…' : 'Сохранить упражнение' }}</button>
            </form>
          </section>

          <section class="panel library-panel">
            <div class="panel-heading"><div><p class="eyebrow">БИБЛИОТЕКА</p><h2>Ваши упражнения</h2></div><span>{{ exercises().length }}</span></div>
            @if (loading()) { <p class="empty">Загружаем библиотеку…</p> }
            @else if (!exercises().length) { <p class="empty">Пока нет упражнений. Добавьте первое — оно появится в сборке тренировки.</p> }
            @else { <div class="exercise-list">
              @for (exercise of exercises(); track exercise.id) {
                <article class="exercise-card">
                  @if (exercise.thumbnail_url) { <img [src]="exercise.thumbnail_url" [alt]="exercise.title" /> }
                  <div><p class="tag">{{ directionLabels[exercise.direction] }} · {{ exercise.muscle_group }}</p><h3>{{ exercise.title }}</h3>
                    @if (exercise.instruction) { <p class="instruction">{{ exercise.instruction }}</p> }
                    @if (exercise.video_url) { <a [href]="exercise.video_url" target="_blank" rel="noopener noreferrer">Видео: {{ exercise.video_platform }}</a> }
                  </div>
                </article>
              }
            </div> }
          </section>
        </div>
      } @else {
        <div class="layout workout-layout">
          <section class="panel form-panel">
            <p class="eyebrow">НОВАЯ ТРЕНИРОВКА</p>
            <h2>Соберите тренировку</h2>
            @if (!exercises().length && !loading()) {
              <div class="notice">Сначала добавьте хотя бы одно упражнение в библиотеку.<button type="button" (click)="activeTab.set('exercises')">Перейти к упражнениям</button></div>
            } @else {
              <form (ngSubmit)="createWorkout()">
                <label>Название *<input name="workoutTitle" [(ngModel)]="workoutTitle" required maxlength="160" placeholder="Тренировка на грудь" /></label>
                <label>Краткое описание<textarea name="workoutDescription" [(ngModel)]="workoutDescription" maxlength="2000" placeholder="Цель и особенности тренировки"></textarea></label>
                @for (kind of blockKinds; track kind) {
                  <section class="workout-block">
                    <div class="block-heading"><h3>{{ blockLabels[kind] }}</h3><button type="button" (click)="addWorkoutExercise(kind)">+ Упражнение</button></div>
                    @if (!itemsFor(kind).length) { <p class="block-empty">Блок можно оставить пустым.</p> }
                    @for (item of itemsFor(kind); track $index; let index = $index) {
                      <div class="workout-item">
                        <select [ngModel]="item.exerciseId" [name]="kind + '-exercise-' + index" (ngModelChange)="updateWorkoutItem(kind, index, 'exerciseId', $event)">
                          @for (exercise of exercises(); track exercise.id) { <option [value]="exercise.id">{{ exercise.title }}</option> }
                        </select>
                        <label>Вес, кг<input type="number" min="0" max="1000" step="0.25" [ngModel]="item.weightKg" [name]="kind + '-weight-' + index" (ngModelChange)="updateWorkoutItem(kind, index, 'weightKg', $event)" /></label>
                        <label>Подходы<input type="number" min="1" max="100" [ngModel]="item.sets" [name]="kind + '-sets-' + index" (ngModelChange)="updateWorkoutItem(kind, index, 'sets', $event)" /></label>
                        <label>Повторы<input type="number" min="1" max="1000" [ngModel]="item.reps" [name]="kind + '-reps-' + index" (ngModelChange)="updateWorkoutItem(kind, index, 'reps', $event)" /></label>
                        <button class="remove" type="button" (click)="removeWorkoutExercise(kind, index)" aria-label="Удалить упражнение">×</button>
                      </div>
                    }
                  </section>
                }
                <button class="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Сохраняем…' : 'Сохранить тренировку' }}</button>
              </form>
            }
          </section>

          <section class="panel library-panel">
            <div class="panel-heading"><div><p class="eyebrow">ТЕКУЩИЕ</p><h2>Тренировки</h2></div><span>{{ workouts().length }}</span></div>
            @if (loading()) { <p class="empty">Загружаем тренировки…</p> }
            @else if (!workouts().length) { <p class="empty">Сохранённые тренировки появятся здесь.</p> }
            @else { <div class="workout-list">
              @for (workout of workouts(); track workout.id) { <article class="saved-workout"><h3>{{ workout.title }}</h3><p>{{ workout.description || 'Без описания' }}</p>
                <div class="saved-blocks">@for (block of workout.blocks; track block.id) { <span>{{ blockLabels[block.kind] }}: {{ block.exercises.length }}</span> }</div>
              </article> }
            </div> }
          </section>
        </div>
      }
    </main>
  `,
  styles: `
    :host{display:block}.screen{min-height:100dvh;background:#14181d;color:#f5f7fa;font-family:'Golos Text',system-ui,sans-serif;padding:clamp(1rem,3vw,2rem);box-sizing:border-box}.toolbar,.panel-heading,.block-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.back{color:#9aa6b8;text-decoration:none;font-size:.9rem}.toolbar h1{margin:.5rem 0 .25rem;font-size:clamp(1.5rem,3vw,2.25rem);font-family:'Unbounded',sans-serif}.toolbar p{margin:0;color:#9aa6b8}.tabs{display:flex;gap:.5rem;flex-wrap:wrap}.tabs button,.block-heading button,.notice button{border:1px solid rgb(245 247 250 / 15%);border-radius:.55rem;background:transparent;color:#f5f7fa;padding:.6rem .9rem;font:inherit;cursor:pointer}.tabs button.is-active,.primary{border-color:#c9f24b;background:#c9f24b;color:#14181d;font-weight:700}.message{margin:1rem 0;padding:.75rem 1rem;border-radius:.6rem;background:rgb(201 242 75 / 12%);color:#d9fb76}.message.is-error{background:rgb(255 115 115 / 12%);color:#ffabab}.layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(20rem,.9fr);gap:1rem;margin-top:1.5rem;max-width:80rem}.panel{padding:clamp(1rem,2vw,1.5rem);border:1px solid rgb(245 247 250 / 9%);border-radius:1rem;background:#1c222b}.eyebrow,.tag{margin:0;color:#8e9aae;font-family:'JetBrains Mono',monospace;font-size:.7rem;letter-spacing:.08em}.panel h2{margin:.4rem 0 1.25rem;font-size:1.25rem}.panel-heading span{display:grid;place-items:center;min-width:2rem;height:2rem;border-radius:999px;background:#29313c;color:#c9f24b;font-family:monospace}form{display:grid;gap:.85rem}label{display:grid;gap:.35rem;color:#b9c2d0;font-size:.85rem;font-weight:600}input,textarea,select{width:100%;box-sizing:border-box;border:1px solid rgb(245 247 250 / 13%);border-radius:.55rem;background:#14181d;color:#f5f7fa;padding:.7rem .8rem;font:inherit;font-weight:400}textarea{min-height:5.5rem;resize:vertical}.fields{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.primary{justify-self:start;border:0;border-radius:.6rem;padding:.75rem 1rem;font:inherit;cursor:pointer}.primary:disabled{opacity:.6;cursor:wait}.empty,.block-empty{color:#9aa6b8;line-height:1.5}.exercise-list,.workout-list{display:grid;gap:.75rem}.exercise-card,.saved-workout{display:grid;grid-template-columns:5rem 1fr;gap:.8rem;padding:.8rem;border:1px solid rgb(245 247 250 / 8%);border-radius:.75rem;background:#171c22}.exercise-card img{width:5rem;height:5rem;object-fit:cover;border-radius:.55rem}.exercise-card h3,.saved-workout h3{margin:.25rem 0 .4rem;font-size:1rem}.instruction,.saved-workout p{margin:.4rem 0;color:#aeb8c6;font-size:.86rem;line-height:1.4}.exercise-card a{color:#c9f24b;font-size:.8rem}.notice{display:grid;gap:.75rem;padding:.9rem;border:1px solid rgb(201 242 75 / 24%);border-radius:.7rem;background:rgb(201 242 75 / 7%);color:#d8e8b1}.notice button{justify-self:start;color:#c9f24b}.workout-block{display:grid;gap:.65rem;padding:.9rem;border:1px solid rgb(245 247 250 / 9%);border-radius:.75rem}.block-heading{align-items:center}.block-heading h3{margin:0;font-size:1rem}.block-heading button{padding:.35rem .55rem;color:#c9f24b;font-size:.8rem}.block-empty{margin:0;font-size:.85rem}.workout-item{display:grid;grid-template-columns:minmax(10rem,1fr) 5.4rem 4.6rem 4.6rem 2rem;gap:.45rem;align-items:end}.workout-item label{font-size:.7rem}.workout-item input,.workout-item select{padding:.55rem}.remove{height:2.3rem;border:0;border-radius:.5rem;background:#323944;color:#f5f7fa;font-size:1.2rem;cursor:pointer}.saved-workout{display:block}.saved-blocks{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.75rem}.saved-blocks span{padding:.3rem .5rem;border-radius:.4rem;background:#29313c;color:#c9f24b;font:700 .7rem monospace}@media(max-width:52rem){.toolbar,.panel-heading{flex-direction:column}.layout{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.workout-item{grid-template-columns:1fr 1fr 1fr 1fr 2rem}.workout-item select{grid-column:span 4}}@media(max-width:30rem){.workout-item{grid-template-columns:1fr 1fr}.workout-item select{grid-column:span 2}.remove{grid-column:2}.screen{padding:1rem}}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerProgramsComponent {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  protected readonly directions: readonly ExerciseDirection[] = ['speed', 'strength', 'agility', 'cardio'];
  protected readonly directionLabels = DIRECTION_LABELS;
  protected readonly blockKinds = BLOCK_KINDS;
  protected readonly blockLabels = BLOCK_LABELS;
  protected readonly activeTab = signal<'exercises' | 'workouts'>('exercises');
  protected readonly exercises = signal<Exercise[]>([]);
  protected readonly workouts = signal<Workout[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly isError = signal(false);
  protected readonly workoutBlocks = signal<Record<WorkoutBlockKind, WorkoutExerciseDraft[]>>({ warmup: [], main: [], cooldown: [] });

  protected exerciseTitle = '';
  protected exerciseDirection: ExerciseDirection = 'strength';
  protected exerciseMuscleGroup = '';
  protected exerciseInstruction = '';
  protected exerciseReferenceUrl = '';
  protected exerciseVideoPlatform: VideoPlatform | '' = '';
  protected exerciseVideoUrl = '';
  protected exerciseVideoFileUrl = '';
  protected exerciseThumbnailUrl = '';
  protected workoutTitle = '';
  protected workoutDescription = '';

  constructor() { this.loadData(); }

  protected itemsFor(kind: WorkoutBlockKind): readonly WorkoutExerciseDraft[] { return this.workoutBlocks()[kind]; }

  protected addWorkoutExercise(kind: WorkoutBlockKind): void {
    const firstExercise = this.exercises()[0];
    if (!firstExercise) return;
    this.workoutBlocks.update((blocks) => ({ ...blocks, [kind]: [...blocks[kind], { exerciseId: firstExercise.id, weightKg: null, sets: 3, reps: 10 }] }));
  }

  protected removeWorkoutExercise(kind: WorkoutBlockKind, index: number): void {
    this.workoutBlocks.update((blocks) => ({ ...blocks, [kind]: blocks[kind].filter((_, itemIndex) => itemIndex !== index) }));
  }

  protected updateWorkoutItem(kind: WorkoutBlockKind, index: number, field: keyof WorkoutExerciseDraft, value: string | number | null): void {
    this.workoutBlocks.update((blocks) => ({
      ...blocks,
      [kind]: blocks[kind].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'exerciseId' ? String(value) : this.toNumber(value) } : item),
    }));
  }

  protected createExercise(): void {
    this.busy.set(true); this.clearMessage();
    this.http.post<Exercise>(`${this.config.apiBaseUrl}/exercises`, {
      title: this.exerciseTitle.trim(), direction: this.exerciseDirection, muscle_group: this.exerciseMuscleGroup.trim(), instruction: this.exerciseInstruction.trim(),
      reference_url: this.optional(this.exerciseReferenceUrl), video_platform: this.exerciseVideoPlatform || null, video_url: this.optional(this.exerciseVideoUrl),
      video_file_url: this.optional(this.exerciseVideoFileUrl), thumbnail_url: this.optional(this.exerciseThumbnailUrl),
    }).subscribe({
      next: (exercise) => { this.exercises.update((items) => [...items, exercise]); this.resetExerciseForm(); this.showMessage('Упражнение сохранено.'); },
      error: (error) => this.showMessage(this.errorMessage(error), true),
      complete: () => this.busy.set(false),
    });
  }

  protected createWorkout(): void {
    const blocks = BLOCK_KINDS.map((kind) => ({ kind, exercises: this.itemsFor(kind).map((item) => ({ exercise_id: item.exerciseId, weight_kg: item.weightKg, sets: item.sets, reps: item.reps })) })).filter((block) => block.exercises.length);
    if (!blocks.length) { this.showMessage('Добавьте хотя бы одно упражнение в тренировку.', true); return; }
    this.busy.set(true); this.clearMessage();
    this.http.post<Workout>(`${this.config.apiBaseUrl}/workouts`, { title: this.workoutTitle.trim(), description: this.workoutDescription.trim(), blocks }).subscribe({
      next: (workout) => { this.workouts.update((items) => [...items, workout]); this.workoutTitle = ''; this.workoutDescription = ''; this.workoutBlocks.set({ warmup: [], main: [], cooldown: [] }); this.showMessage('Тренировка сохранена.'); },
      error: (error) => this.showMessage(this.errorMessage(error), true),
      complete: () => this.busy.set(false),
    });
  }

  private loadData(): void {
    this.http.get<Exercise[]>(`${this.config.apiBaseUrl}/exercises`).subscribe({
      next: (exercises) => { this.exercises.set(exercises); this.http.get<Workout[]>(`${this.config.apiBaseUrl}/workouts`).subscribe({ next: (workouts) => this.workouts.set(workouts), error: (error) => this.showMessage(this.errorMessage(error), true), complete: () => this.loading.set(false) }); },
      error: (error) => { this.showMessage(this.errorMessage(error), true); this.loading.set(false); },
    });
  }

  private resetExerciseForm(): void { this.exerciseTitle = ''; this.exerciseMuscleGroup = ''; this.exerciseInstruction = ''; this.exerciseReferenceUrl = ''; this.exerciseVideoPlatform = ''; this.exerciseVideoUrl = ''; this.exerciseVideoFileUrl = ''; this.exerciseThumbnailUrl = ''; }
  private optional(value: string): string | null { const normalized = value.trim(); return normalized || null; }
  private toNumber(value: string | number | null): number | null { if (value === '' || value === null) return null; const numberValue = Number(value); return Number.isFinite(numberValue) ? numberValue : null; }
  private clearMessage(): void { this.message.set(''); this.isError.set(false); }
  private showMessage(value: string, error = false): void { this.message.set(value); this.isError.set(error); }
  private errorMessage(error: { error?: { detail?: string } }): string { return error.error?.detail || 'Не удалось сохранить данные. Проверьте обязательные поля и ссылки.'; }
}
