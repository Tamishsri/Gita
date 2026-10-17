module.exports = {
    root: true,
    env: { browser: true, es2022: true },
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended'
    ],
    ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    settings: { react: { version: '18.2' } },
    plugins: ['react-refresh'],
    rules: {
        'react/prop-types': 'off',
        'react/jsx-no-target-blank': 'off',
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    },
    overrides: [
        {
            files: ['src/pwa/sw.js'],
            env: { browser: false, serviceworker: true },
            globals: { WisdomEngine: 'readonly', __PRECACHE_MANIFEST__: 'readonly', __BUILD_VERSION__: 'readonly' }
        },
        {
            files: ['vite.config.js', 'scripts/**/*.mjs'],
            env: { browser: false, node: true }
        }
    ]
};
