import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/.astro',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'layer:runtime',
              onlyDependOnLibsWithTags: [
                'layer:contract',
                'layer:ui',
                'scope:foundation',
              ],
            },
            {
              sourceTag: 'layer:app',
              onlyDependOnLibsWithTags: [
                'layer:contract',
                'layer:ui',
                'layer:runtime',
              ],
            },
            {
              sourceTag: 'layer:e2e',
              onlyDependOnLibsWithTags: ['layer:app'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['libs/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@sneat/extension-[a-z0-9-]+-internal(?:/|$)',
              message: 'Extension libraries must use contract tokens, never another extension runtime.',
            },
            {
              regex: '^@sneat/extension-(?!.*-(?:contract|ui|shared)$)[a-z0-9-]+$',
              message: 'Unsuffixed extension runtime packages are app-composition APIs.',
            },
            {
              regex: '^@sneat/(?:contactus|calendarius)-(?:core|services|internal)(?:/|$)',
              message: 'Import the extension contract or UI package instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
