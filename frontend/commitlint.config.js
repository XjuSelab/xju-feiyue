/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow long subjects up to 100 chars (we use scopes like frontend/round-1).
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    'scope-case': [0],
  },
}
