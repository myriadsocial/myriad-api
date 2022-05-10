module.exports = {
  extends: '@loopback/eslint-config',
  rules: {
    'no-console': 1,
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
  },
};
