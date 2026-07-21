import { HttpClient } from '@angular/common/http';
import {
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { catchError, firstValueFrom, of, tap } from 'rxjs';

export interface RuntimeConfig {
  apiBaseUrl: string;
  release: string;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: '/api/v1',
  release: 'development',
};

let activeRuntimeConfig: RuntimeConfig = { ...DEFAULT_RUNTIME_CONFIG };

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('TOPTRAINERS_RUNTIME_CONFIG');

function normalizeRuntimeConfig(value: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl:
      typeof value.apiBaseUrl === 'string' && value.apiBaseUrl.startsWith('/')
        ? value.apiBaseUrl.replace(/\/$/, '')
        : DEFAULT_RUNTIME_CONFIG.apiBaseUrl,
    release:
      typeof value.release === 'string' && value.release.trim().length > 0
        ? value.release.trim()
        : DEFAULT_RUNTIME_CONFIG.release,
  };
}

/**
 * Loads non-secret runtime settings supplied by the deployment. It is intentionally
 * PWA-only: the SSR showcase gets its public data from the server request path.
 */
export function provideRuntimeConfig(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const http = inject(HttpClient);

      return firstValueFrom(
        http.get<Partial<RuntimeConfig>>('/assets/runtime-config.json').pipe(
          catchError(() => of({})),
          tap((loaded) => {
            activeRuntimeConfig = normalizeRuntimeConfig(loaded);
          }),
        ),
      );
    }),
    {
      provide: RUNTIME_CONFIG,
      useFactory: (): RuntimeConfig => activeRuntimeConfig,
    },
  ]);
}
