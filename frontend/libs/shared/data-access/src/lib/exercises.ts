import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  EXERCISE_OPERATIONS,
  type ExerciseThumbnailConfirmResponse,
  type ExerciseThumbnailReadUrlsRequest,
  type ExerciseVideoConfirmResponse,
  type CreateUploadResponse,
  type ExerciseCreate,
  type ExercisePatch,
  type ExerciseResponse,
  type ExerciseThumbnailUploadRequest,
  type ExerciseVideoUploadRequest,
  type ExerciseMediaReadUrlResponse,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type ExerciseOperation = keyof typeof EXERCISE_OPERATIONS;

export function exerciseOperationPath(operation: ExerciseOperation, id?: string): `/${string}` {
  const path = EXERCISE_OPERATIONS[operation].relativePath;
  if (!path.includes('{')) {
    return path;
  }
  if (!id) {
    throw new Error(`An ID is required for ${operation}`);
  }
  const parameter = operation === 'confirmVideoUpload' || operation === 'confirmThumbnailUpload' || operation === 'getThumbnailUploadStatus' || operation === 'retryVideoStream'
    ? '{media_id}'
    : '{exercise_id}';
  return path.replace(parameter, encodeURIComponent(id)) as `/${string}`;
}

export function uploadFileToPresignedUrl(
  file: File,
  upload: Pick<CreateUploadResponse, 'upload_url' | 'upload_headers'>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', upload.upload_url);
    request.withCredentials = false;
    for (const [name, value] of Object.entries(upload.upload_headers)) {
      request.setRequestHeader(name, String(value));
    }
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error('Не удалось загрузить видео.'));
      }
    });
    request.addEventListener('error', () => reject(new Error('Не удалось загрузить видео.')));
    request.send(file);
  });
}

@Injectable({ providedIn: 'root' })
export class ExercisesApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  list(): Observable<ExerciseResponse[]> {
    return this.http.get<ExerciseResponse[]>(apiUrl(this.config, exerciseOperationPath('list')));
  }

  create(payload: ExerciseCreate): Observable<ExerciseResponse> {
    return this.http.post<ExerciseResponse>(apiUrl(this.config, exerciseOperationPath('create')), payload);
  }

  update(exerciseId: string, payload: ExercisePatch): Observable<ExerciseResponse> {
    return this.http.patch<ExerciseResponse>(
      apiUrl(this.config, exerciseOperationPath('update', exerciseId)),
      payload,
    );
  }

  createVideoUpload(payload: ExerciseVideoUploadRequest): Observable<CreateUploadResponse> {
    return this.http.post<CreateUploadResponse>(
      apiUrl(this.config, exerciseOperationPath('createVideoUpload')),
      payload,
    );
  }

  confirmVideoUpload(mediaId: string): Observable<ExerciseVideoConfirmResponse> {
    return this.http.post<ExerciseVideoConfirmResponse>(
      apiUrl(this.config, exerciseOperationPath('confirmVideoUpload', mediaId)),
      null,
    );
  }

  retryVideoStream(mediaId: string): Observable<ExerciseVideoConfirmResponse> {
    return this.http.post<ExerciseVideoConfirmResponse>(
      apiUrl(this.config, exerciseOperationPath('retryVideoStream', mediaId)),
      null,
    );
  }

  createThumbnailUpload(payload: ExerciseThumbnailUploadRequest): Observable<CreateUploadResponse> {
    return this.http.post<CreateUploadResponse>(
      apiUrl(this.config, exerciseOperationPath('createThumbnailUpload')),
      payload,
    );
  }

  confirmThumbnailUpload(mediaId: string): Observable<ExerciseThumbnailConfirmResponse> {
    return this.http.post<ExerciseThumbnailConfirmResponse>(
      apiUrl(this.config, exerciseOperationPath('confirmThumbnailUpload', mediaId)),
      null,
    );
  }

  getThumbnailUploadStatus(mediaId: string): Observable<ExerciseThumbnailConfirmResponse> {
    return this.http.get<ExerciseThumbnailConfirmResponse>(
      apiUrl(this.config, exerciseOperationPath('getThumbnailUploadStatus', mediaId)),
    );
  }

  createThumbnailReadUrls(
    mediaIds: string[],
  ): Observable<ExerciseMediaReadUrlResponse[]> {
    const payload: ExerciseThumbnailReadUrlsRequest = { media_ids: mediaIds };
    return this.http.post<ExerciseMediaReadUrlResponse[]>(
      apiUrl(this.config, exerciseOperationPath('createThumbnailReadUrls')),
      payload,
    );
  }

  createVideoReadUrl(exerciseId: string): Observable<ExerciseMediaReadUrlResponse> {
    return this.http.post<ExerciseMediaReadUrlResponse>(
      apiUrl(this.config, exerciseOperationPath('createVideoReadUrl', exerciseId)),
      null,
    );
  }

  createThumbnailReadUrl(exerciseId: string): Observable<ExerciseMediaReadUrlResponse> {
    return this.http.post<ExerciseMediaReadUrlResponse>(
      apiUrl(this.config, exerciseOperationPath('createThumbnailReadUrl', exerciseId)),
      null,
    );
  }
}
