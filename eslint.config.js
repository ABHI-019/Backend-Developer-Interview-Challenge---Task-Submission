// eslint.config.js
const eslintTs = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': eslintTs,
    },
    rules: {
      // TypeScript Rules
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // General ESLint Rules
      'no-console': 'off', // Allow console for this project
      'no-unused-vars': 'off', // Using TypeScript's no-unused-vars instead
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
];
