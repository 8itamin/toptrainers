import { ChangeDetectionStrategy, Component, computed, EventEmitter, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { ExerciseResponse, ProgramResponse, WorkoutResponse } from '@toptrainers/shared/contracts';
import { ExercisesApi, ProgramsApi, WorkoutsApi } from '@toptrainers/shared/data-access';

import {
  draftFromWorkout, exerciseTags, programUsage, summarizeWorkout, workoutPayload,
  type BlockKind, type DraftBlock, type DraftExercise,
} from './workout-editor-state';

let localId = 0;
const nextId = () => `local-${++localId}`;

@Component({
  selector: 'tt-workout-constructor',
  standalone: true,
  imports: [RouterLink],
  inputs: ['embedded', 'workout', 'availableExercises', 'exerciseThumbnailUrls', 'programs'],
  outputs: ['closeRequested', 'saved'],
  template: `
    <div class="screen" [class.is-embedded]="embedded">
      <header class="toolbar">
        <div class="left">
          @if (embedded) {
            <button type="button" class="back" (click)="closeRequested.emit()">‹ Тренировки</button>
          } @else { <a class="back" routerLink="/trainer/library">‹ Тренировки</a> }
          <strong class="wname">{{ draft().title || 'Новая тренировка' }}</strong>
          <span class="pill">{{ summary().exerciseCount }} УПР · ~{{ summary().durationMinutes }} МИН</span>
        </div>
        <div class="right">
          <button type="button" class="fill" [disabled]="saving()" (click)="save()">{{ saving() ? 'Сохраняем…' : 'Сохранить' }}</button>
          @if (embedded) { <button type="button" class="close" aria-label="Закрыть тренировку" (click)="closeRequested.emit()">✕</button> }
        </div>
      </header>

      <div class="panels">
        <aside class="picker">
          <div class="label">БИБЛИОТЕКА УПРАЖНЕНИЙ</div>
          <input class="search" type="search" aria-label="Поиск упражнения" placeholder="Поиск упражнения" [value]="search()" (input)="search.set($any($event.target).value)" />
          <div class="picker-chips">
            @for (tag of selectedTags(); track tag) {
              <button type="button" class="pc is-active" [attr.aria-label]="'Убрать тег ' + tag" (click)="removeTag(tag)">{{ tag }} ×</button>
            }
            <select aria-label="Добавить тег" (change)="addTag($event)">
              <option value="">＋ Тег</option>
              @for (tag of availableTags(); track tag) { @if (!selectedTags().includes(tag)) { <option [value]="tag">{{ tag }}</option> } }
            </select>
          </div>
          <div class="picker-list">
            @for (exercise of filteredExercises(); track exercise.id) {
              <button type="button" class="pick-card" (click)="addFromLibrary(exercise)" [attr.aria-label]="'Добавить упражнение ' + exercise.title">
                <span class="pick-photo">
                  @if (thumbnailUrl(exercise); as url) { <img [src]="url" [alt]="exercise.title" width="320" height="180" loading="lazy" /> }
                  @else { <span class="pick-placeholder">Фото нет</span> }
                </span>
                <span class="pick-name">{{ exercise.title }}</span>
              </button>
            } @empty { <p class="empty">Упражнений по этим тегам нет.</p> }
          </div>
        </aside>

        <section class="editor">
          <label class="field"><span class="label">НАЗВАНИЕ ТРЕНИРОВКИ</span>
            <input class="value name" aria-label="Название тренировки" maxlength="160" [value]="draft().title" (input)="setTitle($any($event.target).value)" />
          </label>
          <label class="field"><span class="label">ОПИСАНИЕ</span>
            <textarea class="value description" aria-label="Описание тренировки" maxlength="2000" rows="3" [value]="draft().description" (input)="setDescription($any($event.target).value)"></textarea>
          </label>
          <div class="ex-head"><span class="label">УПРАЖНЕНИЯ · {{ summary().exerciseCount }}</span><span class="label">{{ summary().totalSets }} подходов · ~{{ summary().durationMinutes }} мин</span></div>

          <div class="blocks">
            @for (block of draft().blocks; track block.id; let blockIndex = $index) {
              <section class="training-block" [class.is-selected]="selectedBlockId() === block.id">
                <div class="block-head">
                  <button type="button" class="block-select" (click)="selectedBlockId.set(block.id)" [attr.aria-label]="'Выбрать блок ' + (blockIndex + 1)">БЛОК {{ blockIndex + 1 }}</button>
                  <input class="block-title" [attr.aria-label]="'Название блока ' + (blockIndex + 1)" maxlength="160" [value]="block.title" (input)="setBlockTitle(block.id, $any($event.target).value)" />
                  <select [attr.aria-label]="'Тип блока ' + (blockIndex + 1)" [value]="block.kind" (change)="setBlockKind(block.id, $any($event.target).value)">
                    <option value="warmup">Разминка</option><option value="main">Основной</option><option value="cooldown">Заминка</option>
                  </select>
                  <button type="button" class="rm" [attr.aria-label]="'Удалить блок ' + (blockIndex + 1)" (click)="removeBlock(block.id)">✕</button>
                </div>
                @for (item of block.exercises; track item.id; let i = $index) {
                  <article class="exercise" [class.is-selected]="selectedExerciseId() === item.id" (click)="selectExercise(block.id, item.id)">
                    <div class="exercise-row">
                      <span class="tag">{{ blockIndex + 1 }}.{{ i + 1 }}</span>
                      @if (findExercise(item.exercise_id); as source) {
                        <span class="thumb">@if (thumbnailUrl(source); as url) { <img [src]="url" [alt]="source.title" width="64" height="48" /> }</span>
                        <span class="exercise-name">{{ source.title }}</span>
                      } @else { <span class="exercise-name">Упражнение недоступно</span> }
                      <button type="button" class="move" aria-label="Выше" [disabled]="i === 0" (click)="moveExercise(block.id, i, -1); $event.stopPropagation()">↑</button>
                      <button type="button" class="move" aria-label="Ниже" [disabled]="i === block.exercises.length - 1" (click)="moveExercise(block.id, i, 1); $event.stopPropagation()">↓</button>
                      <button type="button" class="rm" aria-label="Удалить упражнение" (click)="removeExercise(block.id, item.id); $event.stopPropagation()">✕</button>
                    </div>
                    @if (selectedExerciseId() === item.id) {
                      <div class="steppers">
                        <div class="stp"><label class="stp-label">ПОДХОДЫ</label><div class="stp-box"><button type="button" (click)="bump(item.id, 'sets', -1); $event.stopPropagation()">−</button><input type="number" min="1" max="100" step="1" aria-label="Подходы" [value]="item.sets" (change)="setNumeric(item.id, 'sets', $any($event.target).value)" (click)="$event.stopPropagation()" /><button type="button" (click)="bump(item.id, 'sets', 1); $event.stopPropagation()">+</button></div></div>
                        <div class="stp"><label class="stp-label">ПОВТОРЫ</label><div class="stp-box"><button type="button" (click)="bump(item.id, 'reps', -1); $event.stopPropagation()">−</button><input type="number" min="1" max="1000" step="1" aria-label="Повторы" [value]="item.reps" (change)="setNumeric(item.id, 'reps', $any($event.target).value)" (click)="$event.stopPropagation()" /><button type="button" (click)="bump(item.id, 'reps', 1); $event.stopPropagation()">+</button></div></div>
                        <div class="stp"><label class="stp-label">ВЕС, КГ</label><div class="stp-box"><button type="button" (click)="bump(item.id, 'weight_kg', -2.5); $event.stopPropagation()">−</button><input type="number" min="0" max="1000" step="0.01" aria-label="Вес, кг" [value]="item.weight_kg ?? ''" (change)="setNumeric(item.id, 'weight_kg', $any($event.target).value)" (click)="$event.stopPropagation()" /><button type="button" (click)="bump(item.id, 'weight_kg', 2.5); $event.stopPropagation()">+</button></div></div>
                        <div class="stp"><label class="stp-label">ОТДЫХ, С</label><div class="stp-box"><button type="button" (click)="bump(item.id, 'rest_seconds', -15); $event.stopPropagation()">−</button><input type="number" min="0" max="3600" step="1" aria-label="Отдых, секунды" [value]="item.rest_seconds" (change)="setNumeric(item.id, 'rest_seconds', $any($event.target).value)" (click)="$event.stopPropagation()" /><button type="button" (click)="bump(item.id, 'rest_seconds', 15); $event.stopPropagation()">+</button></div></div>
                      </div>
                    } @else { <div class="chip-row"><span class="chip">{{ item.sets }} × {{ item.reps }}</span><span class="chip">{{ item.weight_kg ?? 0 }} кг</span><span class="chip">отдых {{ item.rest_seconds }} с</span></div> }
                  </article>
                } @empty { <p class="empty">Выберите блок и добавьте упражнение из библиотеки слева.</p> }
              </section>
            }
            <div class="add-row"><button type="button" class="dashed" (click)="addBlock()">＋ Блок</button><button type="button" class="dashed" (click)="addTask()">＋ Задача</button></div>
          </div>
        </section>

        <aside class="summary-panel">
          <div class="sum-title">СВОДКА ТРЕНИРОВКИ</div>
          <div class="sum-scores"><div class="sum-cell"><strong>{{ summary().totalSets }}</strong><span>ПОДХОДОВ</span></div><div class="sum-cell"><strong>{{ summary().durationMinutes }}</strong><span>МИНУТ</span></div></div>
          <div><div class="label">НАГРУЗКА ПО ГРУППАМ</div><div class="load">
            @for (entry of summary().load; track entry.name) { <div class="load-row"><div class="load-head">{{ entry.name }} <span>{{ entry.sets }}</span></div><div class="load-bar"><i [style.width.%]="loadPercent(entry.sets)"></i></div></div> }
            @if (summary().load.length === 0) { <p class="empty">Добавьте упражнения, чтобы увидеть нагрузку.</p> }
          </div></div>
          <div><div class="label">ИСПОЛЬЗУЕТСЯ В ПРОГРАММАХ</div><div class="used">
            @for (entry of usage(); track entry.title) { <div class="used-row"><span>{{ entry.title }}</span><span>×{{ entry.count }}</span></div> }
            @if (usage().length === 0) { <p class="empty">Пока не используется.</p> }
          </div></div>
          <p class="note">Изменения шаблона видны в программах; уже выданные тренировки сохраняют прежнюю версию.</p>
          @if (message()) { <p class="message" role="status">{{ message() }}</p> }
        </aside>
      </div>
    </div>
  `,
  styles: `
    :host{display:block}.screen{min-height:100dvh;background:#14181d;color:#f5f7fa;font-family:'Golos Text',system-ui,sans-serif}.screen.is-embedded{min-height:0}
    button,input,textarea,select{font:inherit}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding:1.125rem 1.75rem;border-bottom:1px solid #ffffff12}.left,.right{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}.back{border:0;background:none;color:#8a94a6;text-decoration:none;cursor:pointer}.wname{font-family:Unbounded,sans-serif;font-size:1.05rem}.pill,.label,.stp-label{font-family:'JetBrains Mono',monospace;color:#8a94a6;letter-spacing:.06em;font-size:.625rem}.pill{background:#1c222b;padding:.3rem .5rem;border-radius:99px}.fill{border:0;border-radius:.55rem;background:#c9f24b;color:#14181d;font-weight:700;padding:.6rem 1rem;cursor:pointer}.fill:disabled{opacity:.6}.close{border:1px solid #ffffff28;background:none;color:#fff;border-radius:.5rem;width:2.25rem;height:2.25rem;cursor:pointer}
    .panels{display:flex;min-height:calc(100dvh - 4.5rem)}.is-embedded .panels{min-height:0}.picker{width:20rem;flex:none;padding:1.25rem 1.125rem;border-right:1px solid #ffffff12;display:flex;flex-direction:column;gap:.75rem}.search,.value,.block-title,.block-head select,.picker-chips select{background:#1c222b;border:1px solid #ffffff1a;color:#f5f7fa;border-radius:.6rem;padding:.65rem .75rem;min-width:0}.search{width:100%;box-sizing:border-box}.picker-chips{display:flex;flex-wrap:wrap;gap:.4rem}.pc{border:0;border-radius:.45rem;background:#c9f24b;color:#14181d;padding:.4rem .55rem;cursor:pointer;font-size:.7rem;font-weight:700}.picker-chips select{font-size:.7rem;padding:.35rem .45rem}.picker-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:.625rem;max-height:70dvh;overflow:auto}.pick-card{overflow:hidden;border:1px solid #ffffff14;border-radius:.7rem;background:#1c222b;color:inherit;text-align:left;cursor:pointer;padding:0}.pick-card:hover,.pick-card:focus-visible{border-color:#c9f24b}.pick-photo{display:block;aspect-ratio:16/9;background:#252c35}.pick-photo img{width:100%;height:100%;object-fit:cover}.pick-placeholder{height:100%;display:grid;place-items:center;color:#8a94a6;font-size:.7rem}.pick-name{display:block;padding:.6rem;font-size:.75rem;font-weight:600}
    .editor{flex:1;min-width:0;padding:1.5rem 1.75rem;border-right:1px solid #ffffff12}.field{display:block;margin-bottom:.8rem}.field .label{display:block;margin-bottom:.4rem}.value{display:block;box-sizing:border-box;width:100%}.name{font-family:Unbounded,sans-serif;font-weight:600;font-size:1.15rem}.description{resize:vertical;line-height:1.5}.ex-head{display:flex;justify-content:space-between;gap:.5rem;margin:1.5rem 0 .75rem}.blocks{display:flex;flex-direction:column;gap:.75rem}.training-block{border:1px solid #ffffff18;border-radius:.85rem;padding:.75rem;background:#181d23}.training-block.is-selected{border-color:#2f5cff}.block-head{display:flex;align-items:center;gap:.55rem;margin-bottom:.7rem}.block-select{border:0;background:none;color:#c9f24b;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:.7rem;cursor:pointer}.block-title{flex:1}.block-head select{font-size:.75rem}.rm,.move{border:0;background:none;color:#8a94a6;cursor:pointer}.move:disabled{opacity:.3;cursor:default}.exercise{background:#1c222b;border:1px solid transparent;border-radius:.7rem;padding:.7rem;margin-top:.5rem;cursor:pointer}.exercise.is-selected{border-color:#2f5cff}.exercise-row{display:flex;align-items:center;gap:.55rem}.tag{background:#2a323d;border-radius:.4rem;padding:.35rem;font-family:'JetBrains Mono',monospace;font-size:.7rem}.thumb{width:3rem;height:2.2rem;background:#252c35;border-radius:.35rem;overflow:hidden;flex:none}.thumb img{width:100%;height:100%;object-fit:cover}.exercise-name{flex:1;font-weight:600;min-width:0}.steppers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem;margin-top:.8rem}.stp-label{display:block;margin-bottom:.25rem}.stp-box{display:flex;align-items:center;background:#14181d;border-radius:.5rem;padding:.35rem}.stp-box button{border:0;background:none;color:#c9f24b;cursor:pointer;padding:.25rem}.stp-box input{width:100%;min-width:0;background:none;border:0;color:#fff;text-align:center;appearance:textfield}.stp-box input::-webkit-inner-spin-button{appearance:none}.chip-row{display:flex;gap:.4rem;margin-top:.6rem}.chip{background:#14181d;border-radius:.4rem;padding:.35rem .5rem;font-size:.7rem}.add-row{display:flex;gap:.6rem}.dashed{flex:1;background:none;border:1px dashed #ffffff35;border-radius:.7rem;color:#8a94a6;padding:.75rem;cursor:pointer}.empty{color:#8a94a6;font-size:.75rem;line-height:1.5}
    .summary-panel{width:18.75rem;flex:none;padding:1.5rem 1.375rem;display:flex;flex-direction:column;gap:1.2rem}.sum-title{font-family:'JetBrains Mono',monospace;font-size:.65rem;letter-spacing:.07em}.sum-scores{display:flex;gap:.5rem}.sum-cell{flex:1;padding:.8rem;background:#1c222b;border-radius:.7rem}.sum-cell strong{display:block;font-family:Unbounded,sans-serif;font-size:1.4rem}.sum-cell:first-child strong{color:#c9f24b}.sum-cell span{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:#8a94a6}.load{margin-top:.6rem;display:flex;flex-direction:column;gap:.5rem}.load-head{display:flex;justify-content:space-between;font-size:.75rem}.load-head span{color:#8a94a6}.load-bar{height:.4rem;border-radius:99px;background:#ffffff18;margin-top:.25rem}.load-bar i{display:block;height:100%;background:#c9f24b;border-radius:99px}.used{margin-top:.6rem}.used-row{display:flex;justify-content:space-between;gap:.5rem;background:#1c222b;border-radius:.5rem;padding:.65rem;font-size:.75rem;margin-bottom:.4rem}.note{color:#8a94a6;font-size:.75rem;line-height:1.5}.message{color:#c9f24b;font-size:.8rem}
    @media(max-width:1180px){.panels{flex-wrap:wrap}.picker{width:17rem}.summary-panel{width:auto;flex:1 1 100%;border-top:1px solid #ffffff12}.editor{border-right:0}}@media(max-width:760px){.picker{width:auto;flex:1 1 100%;border-right:0;border-bottom:1px solid #ffffff12}.picker-list{max-height:15rem}.editor{padding:1.1rem}.steppers{grid-template-columns:repeat(2,minmax(0,1fr))}.block-head{flex-wrap:wrap}.summary-panel{padding:1.1rem}}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutConstructorComponent {
  private readonly workoutsApi = inject(WorkoutsApi);
  private readonly exercisesApi = inject(ExercisesApi);
  private readonly programsApi = inject(ProgramsApi);
  private currentWorkout: WorkoutResponse | null = null;

  embedded = false;
  set workout(value: WorkoutResponse | null) {
    this.currentWorkout = value;
    this.draft.set(draftFromWorkout(value));
    this.selectedBlockId.set(value?.blocks[0]?.id ?? null);
    this.selectedExerciseId.set(value?.blocks[0]?.exercises[0]?.id ?? null);
    this.workoutId.set(value?.id ?? null);
  }
  set availableExercises(value: readonly ExerciseResponse[] | null) { if (value !== null) this.exercises.set(value); }
  exerciseThumbnailUrls: Readonly<Record<string, string>> = {};
  set programs(value: readonly ProgramResponse[]) { this.programList.set(value); }
  readonly closeRequested = new EventEmitter<void>();
  readonly saved = new EventEmitter<WorkoutResponse>();

  protected readonly draft = signal(draftFromWorkout(null));
  protected readonly exercises = signal<readonly ExerciseResponse[]>([]);
  protected readonly programList = signal<readonly ProgramResponse[]>([]);
  protected readonly workoutId = signal<string | null>(null);
  protected readonly selectedBlockId = signal<string | null>(null);
  protected readonly selectedExerciseId = signal<string | null>(null);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly search = signal('');
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly summary = computed(() => summarizeWorkout(this.draft(), this.exercises()));
  protected readonly usage = computed(() => programUsage(this.workoutId(), this.programList()));
  protected readonly availableTags = computed(() => [...new Set(this.exercises().flatMap(exerciseTags))]);
  protected readonly filteredExercises = computed(() => this.exercises().filter((exercise) => {
    const search = this.search().trim().toLocaleLowerCase('ru');
    const tags = exerciseTags(exercise);
    return (!search || exercise.title.toLocaleLowerCase('ru').includes(search)) && this.selectedTags().every((tag) => tags.includes(tag));
  }));

  constructor() {
    queueMicrotask(() => { if (!this.embedded) void this.loadStandalone(); });
  }

  private async loadStandalone(): Promise<void> {
    try { this.exercises.set(await firstValueFrom(this.exercisesApi.list())); } catch { this.message.set('Не удалось загрузить упражнения.'); }
    try { this.programList.set(await firstValueFrom(this.programsApi.list())); } catch { /* Usage stays empty. */ }
  }

  protected thumbnailUrl(exercise: ExerciseResponse): string | null {
    return this.exerciseThumbnailUrls[exercise.thumbnail_media_id ?? ''] ?? exercise.thumbnail_url ?? null;
  }
  protected findExercise(id: string): ExerciseResponse | undefined { return this.exercises().find((exercise) => exercise.id === id); }
  protected loadPercent(sets: number): number { return 100 * sets / Math.max(1, ...this.summary().load.map((item) => item.sets)); }
  protected setTitle(title: string): void { this.draft.update((draft) => ({ ...draft, title })); }
  protected setDescription(description: string): void { this.draft.update((draft) => ({ ...draft, description })); }
  protected addTag(event: Event): void {
    const element = event.target as HTMLSelectElement;
    if (element.value) this.selectedTags.update((tags) => [...tags, element.value]);
    element.value = '';
  }
  protected removeTag(tag: string): void { this.selectedTags.update((tags) => tags.filter((item) => item !== tag)); }
  protected selectExercise(blockId: string, itemId: string): void { this.selectedBlockId.set(blockId); this.selectedExerciseId.set(itemId); }
  protected addBlock(): void {
    if (this.draft().blocks.length >= 12) { this.message.set('Максимум 12 блоков.'); return; }
    const block: DraftBlock = { id: nextId(), title: `Блок ${this.draft().blocks.length + 1}`, kind: 'main', exercises: [] };
    this.draft.update((draft) => ({ ...draft, blocks: [...draft.blocks, block] }));
    this.selectedBlockId.set(block.id);
    this.selectedExerciseId.set(null);
    this.message.set('');
  }
  protected removeBlock(id: string): void {
    this.draft.update((draft) => ({ ...draft, blocks: draft.blocks.filter((block) => block.id !== id) }));
    if (this.selectedBlockId() === id) this.selectedBlockId.set(this.draft().blocks[0]?.id ?? null);
  }
  protected setBlockTitle(id: string, title: string): void { this.changeBlock(id, (block) => ({ ...block, title })); }
  protected setBlockKind(id: string, kind: BlockKind): void { this.changeBlock(id, (block) => ({ ...block, kind })); }
  private changeBlock(id: string, change: (block: DraftBlock) => DraftBlock): void {
    this.draft.update((draft) => ({ ...draft, blocks: draft.blocks.map((block) => block.id === id ? change(block) : block) }));
  }
  protected addFromLibrary(exercise: ExerciseResponse): void {
    if (!this.selectedBlockId()) this.addBlock();
    const blockId = this.selectedBlockId();
    if (!blockId) return;
    const item: DraftExercise = { id: nextId(), exercise_id: exercise.id, sets: 3, reps: 10, weight_kg: null, rest_seconds: 60 };
    this.changeBlock(blockId, (block) => ({ ...block, exercises: [...block.exercises, item] }));
    this.selectedExerciseId.set(item.id);
  }
  protected removeExercise(blockId: string, itemId: string): void {
    this.changeBlock(blockId, (block) => ({ ...block, exercises: block.exercises.filter((item) => item.id !== itemId) }));
    if (this.selectedExerciseId() === itemId) this.selectedExerciseId.set(null);
  }
  protected moveExercise(blockId: string, index: number, delta: number): void {
    this.changeBlock(blockId, (block) => {
      const exercises = [...block.exercises];
      const current = exercises[index];
      const neighbor = exercises[index + delta];
      if (!current || !neighbor) return block;
      exercises[index] = neighbor;
      exercises[index + delta] = current;
      return { ...block, exercises };
    });
  }
  protected setNumeric(itemId: string, field: 'sets' | 'reps' | 'weight_kg' | 'rest_seconds', raw: string): void {
    if (raw === '' && field === 'weight_kg') { this.changeExercise(itemId, (item) => ({ ...item, weight_kg: null })); return; }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const min = field === 'sets' || field === 'reps' ? 1 : 0;
    const max = field === 'sets' ? 100 : field === 'reps' || field === 'weight_kg' ? 1000 : 3600;
    const bounded = Math.min(max, Math.max(min, field === 'weight_kg' ? Math.round(value * 100) / 100 : Math.trunc(value)));
    this.changeExercise(itemId, (item) => ({ ...item, [field]: bounded }));
  }
  protected bump(itemId: string, field: 'sets' | 'reps' | 'weight_kg' | 'rest_seconds', delta: number): void {
    const item = this.draft().blocks.flatMap((block) => block.exercises).find((entry) => entry.id === itemId);
    if (item) this.setNumeric(itemId, field, String((item[field] ?? 0) + delta));
  }
  private changeExercise(id: string, change: (item: DraftExercise) => DraftExercise): void {
    this.draft.update((draft) => ({ ...draft, blocks: draft.blocks.map((block) => ({
      ...block, exercises: block.exercises.map((item) => item.id === id ? change(item) : item),
    })) }));
  }
  protected addTask(): void { this.message.set('Задачи внутри тренировки пока не сохраняются.'); }
  protected async save(): Promise<void> {
    const payload = workoutPayload(this.draft());
    if (!payload.title) { this.message.set('Введите название тренировки.'); return; }
    if (!payload.blocks.length || payload.blocks.some((block) => !block.exercises.length)) {
      this.message.set('Добавьте хотя бы одно упражнение в каждый блок.'); return;
    }
    this.saving.set(true);
    this.message.set('');
    try {
      const saved = await firstValueFrom(this.currentWorkout
        ? this.workoutsApi.replace(this.currentWorkout.id, payload)
        : this.workoutsApi.create(payload));
      this.currentWorkout = saved;
      this.workoutId.set(saved.id);
      this.draft.set(draftFromWorkout(saved));
      this.message.set('Тренировка сохранена.');
      this.saved.emit(saved);
    } catch { this.message.set('Не удалось сохранить тренировку. Проверьте данные и попробуйте снова.'); }
    finally { this.saving.set(false); }
  }
}
