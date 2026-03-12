// eslint.config.js - Flat ESLint configuration for the monorepo.
// Applies TypeScript-aware rules to all .ts/.tsx files; treats unused vars as errors
// (prefixed-underscore args are exempt) and flags explicit any and console usage as warnings.
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
    },
  },
  {
    ignores: ['node_modules', 'dist', 'build', '*.config.js'],
  },
];
