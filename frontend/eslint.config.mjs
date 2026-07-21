import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/.nx/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          allowCircularSelfDependency: false,
          depConstraints: [
            {
              sourceTag: 'scope:pwa',
              onlyDependOnLibsWithTags: ['scope:pwa', 'scope:shared', 'scope:ui', 'scope:offline'],
            },
            {
              sourceTag: 'scope:showcase',
              onlyDependOnLibsWithTags: ['scope:showcase', 'scope:shared', 'scope:ui'],
            },
            {
              sourceTag: 'scope:offline',
              onlyDependOnLibsWithTags: ['scope:offline', 'scope:shared'],
            },
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: ['scope:ui', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
];
