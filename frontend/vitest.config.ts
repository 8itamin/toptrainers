import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

function workspacePath(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      '@toptrainers/ui': workspacePath('./libs/ui/src/index.ts'),
      '@toptrainers/shared/config': workspacePath('./libs/shared/config/src/index.ts'),
      '@toptrainers/shared/contracts': workspacePath('./libs/shared/contracts/src/index.ts'),
      '@toptrainers/shared/data-access': workspacePath('./libs/shared/data-access/src/index.ts'),
      '@toptrainers/shared/domain': workspacePath('./libs/shared/domain/src/index.ts'),
      '@toptrainers/offline': workspacePath('./libs/offline/src/index.ts'),
      '@toptrainers/pwa/feature-role-shell': workspacePath(
        './libs/pwa/feature-role-shell/src/index.ts',
      ),
      '@toptrainers/showcase/blocks': workspacePath('./libs/showcase/blocks/src/index.ts'),
    },
  },
});
