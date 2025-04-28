module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended', // PrettierとESLintを統合
    ],
    rules: {
        'prettier/prettier': 'error', // Prettierのルール違反をエラーにする
        '@typescript-eslint/no-unused-vars': 'warn',
    },
};
