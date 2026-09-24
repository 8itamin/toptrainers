export const EXERCISE_MUSCLE_GROUPS = [
  'Ноги',
  'Грудь',
  'Спина',
  'Плечи',
  'Руки',
  'Кор',
  'Всё тело',
] as const;

export type ExerciseMuscleGroup = (typeof EXERCISE_MUSCLE_GROUPS)[number];
export type ExerciseDirection = 'strength' | 'speed' | 'agility' | 'cardio';

export interface ExerciseEditorDraft {
  id: string | null;
  title: string;
  instruction: string;
  direction: ExerciseDirection;
  muscleGroups: ExerciseMuscleGroup[];
  videoMediaId: string | null;
  thumbnailMediaId: string | null;
  videoFile: File | null;
}

export type VideoValidationResult = { kind: 'valid' } | { kind: 'error'; message: string };
export type VideoUploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
export type ThumbnailUploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
export type VideoStreamStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function emptyExerciseDraft(): ExerciseEditorDraft {
  return {
    id: null,
    title: '',
    instruction: '',
    direction: 'strength',
    muscleGroups: [],
    videoMediaId: null,
    thumbnailMediaId: null,
    videoFile: null,
  };
}

export function addMuscleGroup(
  draft: ExerciseEditorDraft,
  group: ExerciseMuscleGroup,
): ExerciseEditorDraft {
  if (draft.muscleGroups.includes(group)) {
    return draft;
  }
  return { ...draft, muscleGroups: [...draft.muscleGroups, group] };
}

export function removeMuscleGroup(
  draft: ExerciseEditorDraft,
  group: ExerciseMuscleGroup,
): ExerciseEditorDraft {
  return { ...draft, muscleGroups: draft.muscleGroups.filter((item) => item !== group) };
}

export function validateVideoFile(file: Pick<File, 'size' | 'type'>): VideoValidationResult {
  if (!VIDEO_TYPES.has(file.type)) {
    return { kind: 'error', message: 'Поддерживаются MP4, WebM и MOV.' };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { kind: 'error', message: 'Видео должно быть не больше 200 МБ.' };
  }
  if (file.size <= 0) {
    return { kind: 'error', message: 'Выберите непустой видеофайл.' };
  }
  return { kind: 'valid' };
}

export function canSaveExercise(videoUploadStatus: VideoUploadStatus): boolean {
  return videoUploadStatus !== 'uploading';
}

export function canSaveExerciseWithThumbnail(
  videoUploadStatus: VideoUploadStatus,
  thumbnailUploadStatus: ThumbnailUploadStatus,
  thumbnailRequired: boolean,
  videoStreamStatus: VideoStreamStatus = 'NONE',
): boolean {
  return (
    videoUploadStatus !== 'uploading'
    && thumbnailUploadStatus !== 'uploading'
    && (!thumbnailRequired || thumbnailUploadStatus === 'uploaded')
    && !['PROCESSING', 'FAILED'].includes(videoStreamStatus)
  );
}
