import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default defineConfig(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**'] },
  { files: ['tests/**/*.mjs'], extends: [js.configs.recommended] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, angular.configs.tsRecommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    processor: angular.processInlineTemplates,
    rules: {
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: { '@angular-eslint/template/no-non-null-assertion': 'error' },
  },
);
