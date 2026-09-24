import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ExercisesApi, uploadFileToPresignedUrl } from '@toptrainers/shared/data-access';
import type { ExerciseResponse } from '@toptrainers/shared/contracts';

import type { ExerciseModalMode } from './exercise-modal-state';
import {
  addMuscleGroup,
  canSaveExercise,
  canSaveExerciseWithThumbnail,
  emptyExerciseDraft,
  EXERCISE_MUSCLE_GROUPS,
  removeMuscleGroup,
  type ExerciseDirection,
  type ExerciseEditorDraft,
  type ExerciseMuscleGroup,
  type ThumbnailUploadStatus,
  type VideoUploadStatus,
  validateVideoFile,
} from './exercise-editor-state';

type Category = 'load' | 'bodyweight' | 'time' | 'distance';

interface DirectionOption { key: ExerciseDirection; label: string; }
interface CategoryOption { key: Category; title: string; hint: string; }

const THUMBNAIL_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

function validateThumbnailFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (!THUMBNAIL_TYPES.has(file.type)) return 'Поддерживаются JPEG, PNG и WebP.';
  if (file.size <= 0) return 'Выберите непустой файл обложки.';
  if (file.size > MAX_THUMBNAIL_BYTES) return 'Обложка должна быть не больше 5 МБ.';
  return null;
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      video.removeEventListener(eventName, onComplete);
      video.removeEventListener('error', onError);
    };
    const onComplete = (): void => { cleanup(); resolve(); };
    const onError = (): void => { cleanup(); reject(new Error('Не удалось получить кадр из видео.')); };
    video.addEventListener(eventName, onComplete, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function createThumbnailFromVideo(video: HTMLVideoElement): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('Видео ещё не готово для создания обложки.');
  }
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Не удалось подготовить изображение обложки.');
  return new File([blob], `exercise-cover-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

async function createAutoThumbnail(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await waitForVideoEvent(video, 'loadeddata');
    const targetTime = Math.min(1, Math.max(0, video.duration - 0.05));
    if (Math.abs(video.currentTime - targetTime) > 0.01) {
      video.currentTime = targetTime;
      await waitForVideoEvent(video, 'seeked');
    }
    return await createThumbnailFromVideo(video);
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

const DIRECTIONS: readonly DirectionOption[] = [
  { key: 'strength', label: 'Сила' },
  { key: 'speed', label: 'Скорость' },
  { key: 'agility', label: 'Ловкость' },
  { key: 'cardio', label: 'Кардио' },
];

const CATEGORIES: readonly CategoryOption[] = [
  { key: 'load', title: 'Сила', hint: 'ВЕС, КГ × ПОВТОРЕНИЯ' },
  { key: 'bodyweight', title: 'Вес тела', hint: 'ПОВТОРЕНИЯ' },
  { key: 'time', title: 'Статика / кардио', hint: 'ВРЕМЯ, СЕК' },
  { key: 'distance', title: 'Дистанция', hint: 'МЕТРЫ · ВРЕМЯ' },
];

@Component({
  selector: 'tt-exercise-editor',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="backdrop" [class.backdrop--embedded]="embedded()">
      <div class="modal">
        <header class="modal-head">
          <div class="head-left">
            <span class="kicker">{{ mode() === 'create' ? 'НОВОЕ УПРАЖНЕНИЕ' : 'УПРАЖНЕНИЕ' }}</span>
            <span class="name">{{ draft().title || 'Новое упражнение' }}</span>
            @if (mode() === 'edit') { <span class="usage">в 7 тренировках</span> }
          </div>
          <div class="head-right">
            @if (mode() === 'edit') { <button type="button" class="ghost" (click)="duplicate()">Дублировать</button> }
            <button type="button" class="save" [disabled]="saving() || isSavingBlocked()" (click)="save()">{{ saving() ? 'Сохраняем…' : isVideoUploading() ? 'Загрузка видео…' : isThumbnailUploading() ? 'Загрузка обложки…' : 'Сохранить' }}</button>
            @if (embedded()) {
              <button type="button" class="close" (click)="closeRequested.emit()" aria-label="Закрыть">✕</button>
            } @else {
              <a class="close" routerLink="/trainer/library" aria-label="Закрыть">✕</a>
            }
          </div>
        </header>

        <div class="body">
          <div class="video-col">
            <div class="label">ВИДЕО ТЕХНИКИ</div>
            <div class="video">
              @if (previewUrl()) {
                <video #videoPreview class="video-preview" controls crossorigin="anonymous" [poster]="thumbnailPreviewUrl()" [src]="previewUrl()"></video>
              } @else {
                <div class="video-placeholder">
                <span class="play"><svg width="22" height="22" viewBox="0 0 24 24" fill="#14181d" stroke="none"><path d="M8 5v14l11-7z" /></svg></span>
                </div>
              }
            </div>
            <div class="video-actions">
              <input #videoInput class="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime" (change)="selectVideo($event)" />
              <button type="button" class="outline" [class.outline--uploading]="isVideoUploading()" [style.--upload-progress]="(uploadProgress() ?? 0) + '%'" [disabled]="isUploadInProgress()" (click)="startOrRetryVideo(videoInput)">
                {{ isVideoUploading() ? 'Загрузка ' + uploadProgress() + '%' : videoUploadStatus() === 'failed' ? 'Повторить загрузку' : draft().videoMediaId ? 'Заменить файл' : 'Загрузить файл' }}
              </button>
            </div>
            <div class="video-actions video-actions--cover">
              <input #thumbnailInput class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" (change)="selectThumbnail($event)" />
              <button type="button" class="outline" [disabled]="!previewUrl() || isUploadInProgress()" (click)="captureThumbnail()">Сделать кадр обложкой</button>
              <button type="button" class="outline" [disabled]="isUploadInProgress()" (click)="thumbnailInput.click()">{{ isThumbnailUploading() ? 'Загрузка обложки…' : 'Загрузить обложку' }}</button>
            </div>
            <div class="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>
              <span>Клиент видит это видео в плеере перед первым подходом. Оптимум — 20–40 с, вертикаль 9:16.</span>
            </div>
          </div>

          <div class="fields">
            <div class="field">
              <div class="label">НАЗВАНИЕ</div>
              <input class="value value--name" [value]="draft().title" (input)="updateTitle($event)" maxlength="120" aria-label="Название упражнения" />
            </div>

            <div class="field">
              <div class="label-row">
                <span class="label">ОПИСАНИЕ · ВИДИТ КЛИЕНТ</span>
                <span class="counter">184 / 600</span>
              </div>
              <textarea class="value value--desc" [value]="draft().instruction" (input)="updateInstruction($event)" maxlength="600" aria-label="Описание упражнения"></textarea>
            </div>

            <div class="field-pair">
              <label class="field">
                <span class="label">НАПРАВЛЕНИЕ</span>
                <select [value]="draft().direction" (change)="selectDirection($event)">
                  @for (dir of directions; track dir.key) {
                    <option [value]="dir.key">{{ dir.label }}</option>
                  }
                </select>
              </label>
            </div>

            <div class="field">
              <div class="label">КАТЕГОРИЯ · КАК СЧИТАЕТСЯ ПОДХОД</div>
              <div class="count-grid">
                @for (item of categories; track item.key) {
                  <button type="button" class="count" [class.is-active]="item.key === category()" (click)="category.set(item.key)">
                    <span class="radio"><span class="radio-dot"></span></span>
                    <span class="count-text"><span class="count-title">{{ item.title }}</span><span class="count-hint">{{ item.hint }}</span></span>
                  </button>
                }
              </div>
            </div>

            <div class="field">
              <div class="label-row">
                <span class="label">ГРУППА МЫШЦ · МОЖНО НЕСКОЛЬКО</span>
                <span class="hint">ПЕРВАЯ = ОСНОВНАЯ</span>
              </div>
              <div class="chips">
                @for (m of draft().muscleGroups; track m; let first = $first) {
                  <span class="chip" [class.chip--primary]="first">{{ m }} <button type="button" class="chip-x" (click)="removeMuscle(m)">✕</button></span>
                }
                <select class="chip-add" (change)="addMuscleFromSelect($event)" aria-label="Добавить группу мышц">
                  <option value="">＋ Добавить</option>
                  @for (m of muscleGroups; track m) { <option [value]="m" [disabled]="draft().muscleGroups.includes(m)">{{ m }}</option> }
                </select>
              </div>
            </div>
          </div>
        </div>

        @if (message()) { <p class="message">{{ message() }}</p> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .backdrop { min-height: 100dvh; background: #0e1116; display: flex; align-items: flex-start; justify-content: center; padding: clamp(1rem, 4vw, 2.5rem) 1rem; font-family: 'Golos Text', system-ui, sans-serif; }
    .modal { position: relative; width: 100%; max-width: 61.25rem; background: #14181d; border: 1px solid rgb(245 247 250 / 8%); border-radius: 1.25rem; overflow: hidden; box-shadow: 0 30px 90px rgb(20 24 29 / 34%); color: #f5f7fa; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.125rem 1.5rem; border-bottom: 1px solid rgb(245 247 250 / 6%); flex-wrap: wrap; }
    .head-left { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .kicker { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #8a94a6; }
    .name { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.125rem; color: #f5f7fa; }
    .usage { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .head-right { display: flex; align-items: center; gap: 0.625rem; }
    .ghost { border: 0; background: none; color: #8a94a6; font: inherit; font-size: 0.8125rem; cursor: pointer; }
    .save { border: 0; font: inherit; font-size: 0.875rem; font-weight: 700; color: #14181d; background: #c9f24b; padding: 0.625rem 1.125rem; border-radius: 0.5625rem; cursor: pointer; }
    .save:disabled { cursor: wait; opacity: .65; }
    .close { border: 0; background: transparent; color: #8a94a6; text-decoration: none; font: inherit; font-size: 1rem; cursor: pointer; }
    .backdrop--embedded { min-height: 0; padding: 0; background: transparent; }
    .body { display: flex; }
    .video-col { width: 25rem; flex: none; padding: 1.5rem; border-right: 1px solid rgb(245 247 250 / 6%); display: flex; flex-direction: column; gap: 0.875rem; }
    .label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; }
    .video { border-radius: 0.875rem; overflow: hidden; border: 1px solid rgb(245 247 250 / 8%); position: relative; }
    .video-placeholder { height: 18.75rem; background: repeating-linear-gradient(135deg, #1c222b, #1c222b 14px, #20272f 14px, #20272f 28px); display: flex; align-items: center; justify-content: center; }
    .video-preview { display: block; width: 100%; height: 18.75rem; object-fit: contain; background: #0e1116; }
    .play { width: 3.375rem; height: 3.375rem; border-radius: 999px; background: #c9f24b; display: flex; align-items: center; justify-content: center; }
    .video-actions { display: flex; gap: 0.5rem; }
    .outline { flex: 1; text-align: center; font: inherit; font-size: 0.75rem; font-weight: 600; color: #f5f7fa; background: #1c222b; border: 1px solid rgb(245 247 250 / 12%); padding: 0.6875rem; border-radius: 0.5625rem; cursor: pointer; }
    .outline--uploading { color: #14181d; background: linear-gradient(to right, #c9f24b var(--upload-progress), #1c222b var(--upload-progress)); border-color: #c9f24b; cursor: wait; }
    .outline:disabled { cursor: wait; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .upload-progress { align-self: center; font-family: 'JetBrains Mono', monospace; font-size: .625rem; color: #8a94a6; white-space: nowrap; }
    .note { display: flex; align-items: flex-start; gap: 0.5625rem; padding: 0.75rem 0.8125rem; background: rgb(47 92 255 / 10%); border-radius: 0.6875rem; }
    .note svg { flex: none; margin-top: 0.0625rem; }
    .note span { font-size: 0.75rem; line-height: 1.45; color: #8a94a6; }
    .fields { flex: 1; min-width: 0; padding: 1.5rem 1.625rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .label-row .label, .field > .label { display: block; margin-bottom: 0.5rem; }
    .label-row .label { margin: 0; }
    .hint, .counter { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #5b6472; }
    .value { background: #1c222b; border: 1px solid rgb(245 247 250 / 10%); border-radius: 0.6875rem; padding: 0.8125rem 0.9375rem; color: #f5f7fa; }
    .value--name { font: inherit; font-size: 0.9375rem; font-weight: 600; width: 100%; }
    .value--desc { font: inherit; font-size: 0.875rem; line-height: 1.5; width: 100%; min-height: 8.25rem; resize: vertical; }
    .field-pair { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; }
    .field-pair .label { display: block; margin-bottom: 0.5rem; }
    select { width: 100%; appearance: none; background: #1c222b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238a94a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 0.875rem center; border: 1px solid rgb(245 247 250 / 10%); border-radius: 0.6875rem; padding: 0.8125rem 2.5rem 0.8125rem 0.9375rem; color: #f5f7fa; font: inherit; font-size: 0.875rem; cursor: pointer; }
    select:focus { outline: 2px solid rgb(201 242 75 / 55%); outline-offset: 2px; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4375rem; }
    .chip { display: inline-flex; align-items: center; gap: 0.4375rem; font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; background: #2a323d; padding: 0.5rem 0.75rem; border-radius: 0.5rem; }
    .chip--primary { color: #14181d; background: #c9f24b; font-weight: 700; }
    .chip-x { border: 0; background: none; color: #8a94a6; font: inherit; cursor: pointer; padding: 0; }
    .chip--primary .chip-x { color: rgb(20 24 29 / 45%); }
    .chip-add { display: inline-flex; width: auto; align-items: center; gap: 0.375rem; font: inherit; font-size: 0.8125rem; color: #8a94a6; border: 1.5px dashed rgb(245 247 250 / 18%); background: #14181d; padding: 0.4375rem 2rem 0.4375rem 0.75rem; border-radius: 0.5rem; cursor: pointer; }
    .count-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .count { display: flex; align-items: center; gap: 0.6875rem; padding: 0.8125rem 0.875rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); border-radius: 0.6875rem; text-align: left; font: inherit; cursor: pointer; color: inherit; }
    .count.is-active { border-color: #c9f24b; }
    .radio { width: 1.0625rem; height: 1.0625rem; border-radius: 999px; border: 2px solid rgb(245 247 250 / 20%); display: flex; align-items: center; justify-content: center; flex: none; }
    .count.is-active .radio { border-color: #c9f24b; }
    .radio-dot { width: 0.5rem; height: 0.5rem; border-radius: 999px; background: transparent; }
    .count.is-active .radio-dot { background: #c9f24b; }
    .count-text { display: flex; flex-direction: column; gap: 0.1875rem; }
    .count-title { font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; }
    .count-hint { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .message { margin: 0; padding: 0 1.625rem 1rem; font-size: 0.75rem; color: #8a94a6; }
    @media (max-width: 860px) {
      .body { flex-direction: column; }
      .video-col { width: auto; border-right: 0; border-bottom: 1px solid rgb(245 247 250 / 6%); }
      .count-grid { grid-template-columns: 1fr; }
      .backdrop--embedded .modal { min-height: 100dvh; border: 0; border-radius: 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseEditorComponent {
  readonly mode = input<ExerciseModalMode>('edit');
  readonly embedded = input(false);
  readonly exercise = input<ExerciseResponse | null>(null);
  readonly closeRequested = output<void>();
  readonly saved = output<ExerciseResponse>();

  private readonly exercisesApi = inject(ExercisesApi);
  private readonly previewVideo = viewChild<HTMLVideoElement>('videoPreview');

  protected readonly directions = DIRECTIONS;
  protected readonly categories = CATEGORIES;
  protected readonly muscleGroups = EXERCISE_MUSCLE_GROUPS;
  protected readonly category = signal<Category>('load');
  protected readonly draft = signal<ExerciseEditorDraft>(emptyExerciseDraft());
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly thumbnailPreviewUrl = signal<string | null>(null);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly videoUploadStatus = signal<VideoUploadStatus>('idle');
  protected readonly thumbnailUploadStatus = signal<ThumbnailUploadStatus>('idle');
  protected readonly thumbnailRequired = signal(false);
  protected readonly isVideoUploading = computed(
    () => !canSaveExercise(this.videoUploadStatus()),
  );
  protected readonly isThumbnailUploading = computed(() => this.thumbnailUploadStatus() === 'uploading');
  protected readonly canSave = computed(() => canSaveExerciseWithThumbnail(
    this.videoUploadStatus(),
    this.thumbnailUploadStatus(),
    this.thumbnailRequired(),
  ));
  protected readonly isUploadInProgress = computed(
    () => this.isVideoUploading() || this.isThumbnailUploading(),
  );
  protected readonly isSavingBlocked = computed(() => !this.canSave());
  protected readonly saving = signal(false);
  protected readonly message = signal('');

  constructor() {
    effect(() => {
      const exercise = this.exercise();
      if (!exercise) {
        this.draft.set(emptyExerciseDraft());
        this.previewUrl.set(null);
        this.thumbnailPreviewUrl.set(null);
        this.uploadProgress.set(null);
        this.videoUploadStatus.set('idle');
        this.thumbnailUploadStatus.set('idle');
        this.thumbnailRequired.set(false);
        return;
      }
      this.draft.set({
        id: exercise.id,
        title: exercise.title,
        instruction: exercise.instruction ?? '',
        direction: exercise.direction,
        muscleGroups: exercise.muscle_groups,
        videoMediaId: exercise.video_media_id ?? null,
        thumbnailMediaId: exercise.thumbnail_media_id ?? null,
        videoFile: null,
      });
      this.previewUrl.set(null);
      this.thumbnailPreviewUrl.set(null);
      this.uploadProgress.set(null);
      this.videoUploadStatus.set(exercise.video_media_id ? 'uploaded' : 'idle');
      this.thumbnailUploadStatus.set(exercise.thumbnail_media_id ? 'uploaded' : 'idle');
      this.thumbnailRequired.set(false);
      if (exercise.video_media_id) {
        void this.loadPreview(exercise.id);
      }
      if (exercise.thumbnail_media_id) {
        void this.loadThumbnailPreview(exercise.id);
      }
    });
  }

  protected updateTitle(event: Event): void {
    this.draft.update((current) => ({ ...current, title: (event.target as HTMLInputElement).value }));
  }

  protected updateInstruction(event: Event): void {
    this.draft.update((current) => ({ ...current, instruction: (event.target as HTMLTextAreaElement).value }));
  }

  protected removeMuscle(group: ExerciseMuscleGroup): void {
    this.draft.update((current) => removeMuscleGroup(current, group));
  }

  protected selectDirection(event: Event): void {
    this.draft.update((current) => ({
      ...current,
      direction: (event.target as HTMLSelectElement).value as ExerciseDirection,
    }));
  }

  protected addMuscleFromSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const group = select.value as ExerciseMuscleGroup;
    if (group) {
      this.draft.update((current) => addMuscleGroup(current, group));
    }
    select.value = '';
  }

  protected selectVideo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (!file) return;
    const validation = validateVideoFile(file);
    if (validation.kind === 'error') {
      this.videoUploadStatus.set('failed');
      this.message.set(validation.message);
      return;
    }
    this.draft.update((current) => ({ ...current, videoFile: file }));
    this.previewUrl.set(URL.createObjectURL(file));
    this.message.set('');
    void this.uploadVideo(file);
  }

  protected startOrRetryVideo(videoInput: HTMLInputElement): void {
    const file = this.draft().videoFile;
    if (this.videoUploadStatus() === 'failed' && file) {
      void this.uploadVideo(file);
      return;
    }
    videoInput.click();
  }

  protected selectThumbnail(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (!file) return;
    const validationError = validateThumbnailFile(file);
    if (validationError) {
      this.thumbnailUploadStatus.set('failed');
      this.message.set(validationError);
      return;
    }
    this.thumbnailPreviewUrl.set(URL.createObjectURL(file));
    void this.uploadThumbnail(file, 'Обложка загружена. Теперь сохраните упражнение.');
  }

  protected captureThumbnail(): void {
    const video = this.previewVideo();
    if (!video) return;
    void this.captureAndUploadThumbnail(video);
  }

  protected duplicate(): void {
    this.message.set('Дублирование пока не добавлено. Сохраните упражнение и создайте копию вручную.');
  }

  protected async save(): Promise<void> {
    const current = this.draft();
    if (!this.canSave()) return;
    if (!current.title.trim()) {
      this.message.set('Введите название упражнения.');
      return;
    }
    if (current.muscleGroups.length === 0) {
      this.message.set('Выберите хотя бы одну группу мышц.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    try {
      const patch = {
        title: current.title.trim(),
        instruction: current.instruction.trim(),
        direction: current.direction,
        muscle_groups: current.muscleGroups,
        video_media_id: current.videoMediaId,
        thumbnail_media_id: current.thumbnailMediaId,
      };
      let saved: ExerciseResponse;
      if (current.id) {
        saved = await firstValueFrom(this.exercisesApi.update(current.id, patch));
      } else {
        saved = await firstValueFrom(this.exercisesApi.create({
          title: patch.title,
          instruction: patch.instruction,
          direction: patch.direction,
          muscle_group: current.muscleGroups[0]!,
        }));
        saved = await firstValueFrom(this.exercisesApi.update(saved.id, patch));
      }
      this.draft.set({
        id: saved.id,
        title: saved.title,
        instruction: saved.instruction ?? '',
        direction: saved.direction,
        muscleGroups: saved.muscle_groups,
        videoMediaId: saved.video_media_id ?? null,
        thumbnailMediaId: saved.thumbnail_media_id ?? null,
        videoFile: null,
      });
      this.uploadProgress.set(null);
      this.videoUploadStatus.set(saved.video_media_id ? 'uploaded' : 'idle');
      this.thumbnailUploadStatus.set(saved.thumbnail_media_id ? 'uploaded' : 'idle');
      this.message.set('Упражнение сохранено.');
      this.saved.emit(saved);
    } catch {
      this.message.set('Не удалось сохранить упражнение. Проверьте подключение и повторите попытку.');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadPreview(exerciseId: string): Promise<void> {
    try {
      const preview = await firstValueFrom(this.exercisesApi.createVideoReadUrl(exerciseId));
      this.previewUrl.set(preview.read_url);
    } catch {
      this.message.set('Видео пока недоступно для предпросмотра.');
    }
  }

  private async loadThumbnailPreview(exerciseId: string): Promise<void> {
    try {
      const preview = await firstValueFrom(this.exercisesApi.createThumbnailReadUrl(exerciseId));
      this.thumbnailPreviewUrl.set(preview.read_url);
    } catch {
      this.message.set('Обложка пока недоступна для предпросмотра.');
    }
  }

  private async uploadVideo(file: File): Promise<void> {
    this.videoUploadStatus.set('uploading');
    this.thumbnailRequired.set(true);
    this.uploadProgress.set(0);
    this.message.set('');
    try {
      const upload = await firstValueFrom(this.exercisesApi.createVideoUpload({
        content_type: file.type as 'video/mp4' | 'video/webm' | 'video/quicktime',
        content_length: file.size,
      }));
      try {
        await uploadFileToPresignedUrl(file, upload, (progress) => this.uploadProgress.set(progress));
      } catch {
        throw new Error('Не удалось передать видео в хранилище.');
      }
      try {
        const confirmed = await firstValueFrom(this.exercisesApi.confirmVideoUpload(upload.media_id));
        this.draft.update((current) => ({ ...current, videoMediaId: confirmed.media_id }));
      } catch {
        throw new Error('Видео загружено, но не удалось подтвердить его сохранение.');
      }
      this.uploadProgress.set(100);
      this.videoUploadStatus.set('uploaded');
      this.thumbnailUploadStatus.set('uploading');
      try {
        const thumbnail = await createAutoThumbnail(file);
        this.thumbnailPreviewUrl.set(URL.createObjectURL(thumbnail));
        await this.uploadThumbnail(thumbnail, 'Видео и обложка загружены. Теперь сохраните упражнение.');
      } catch {
        this.thumbnailUploadStatus.set('failed');
        this.message.set('Видео загружено. Добавьте обложку кадром или отдельным изображением.');
      }
    } catch (error) {
      this.uploadProgress.set(null);
      this.videoUploadStatus.set('failed');
      this.thumbnailRequired.set(false);
      this.message.set(error instanceof Error ? error.message : 'Не удалось подготовить загрузку видео.');
    }
  }

  private async captureAndUploadThumbnail(video: HTMLVideoElement): Promise<void> {
    try {
      const thumbnail = await createThumbnailFromVideo(video);
      this.thumbnailPreviewUrl.set(URL.createObjectURL(thumbnail));
      await this.uploadThumbnail(thumbnail, 'Кадр сохранён как обложка. Теперь сохраните упражнение.');
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Не удалось сделать кадр обложкой.');
    }
  }

  private async uploadThumbnail(file: File, successMessage: string): Promise<void> {
    this.thumbnailUploadStatus.set('uploading');
    this.message.set('');
    try {
      const upload = await firstValueFrom(this.exercisesApi.createThumbnailUpload({
        content_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        content_length: file.size,
      }));
      await uploadFileToPresignedUrl(file, upload, () => undefined);
      const confirmed = await firstValueFrom(this.exercisesApi.confirmThumbnailUpload(upload.media_id));
      this.draft.update((current) => ({ ...current, thumbnailMediaId: confirmed.media_id }));
      this.thumbnailUploadStatus.set('uploaded');
      this.thumbnailRequired.set(false);
      this.message.set(successMessage);
    } catch {
      this.thumbnailUploadStatus.set('failed');
      this.message.set('Не удалось загрузить обложку. Повторите выбор кадра или изображения.');
    }
  }
}
