import eslint from '@eslint/js';
import eslintImport from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
  eslint.configs.recommended,
  eslintConfigPrettier,
  eslintImport.flatConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'import/extensions': ['error', 'ignorePackages'],
      'import/order': ['error', { alphabetize: { order: 'asc', caseInsensitive: true } }]
    }
  },
  {
    files: ['*.js', '*.mjs', '*.cjs'],
    rules: {}
  }
];
