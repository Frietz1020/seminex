import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended.map((config) => ({ ...config, rules: { ...config.rules, '@typescript-eslint/no-explicit-any': 'warn' } })),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: Object.fromEntries(Object.keys(reactHooks.configs.recommended.rules).map((rule) => [rule, 'warn'])),
  },
];
