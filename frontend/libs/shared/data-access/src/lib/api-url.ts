import type { RuntimeConfig } from '@toptrainers/shared/config';

/**
 * Keeps endpoint composition in one place until the generated OpenAPI client is added.
 * It only accepts relative endpoint paths so a deployment cannot accidentally bypass
 * the configured API origin.
 */
export function apiUrl(config: RuntimeConfig, path: `/${string}`): string {
  const base = config.apiBaseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}
