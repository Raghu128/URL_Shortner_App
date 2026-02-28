/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
    moduleNameMapper: {
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
        '^@workers/(.*)$': '<rootDir>/src/workers/$1',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/server.ts',
        '!src/**/*.types.ts',
        '!src/**/index.ts',
    ],
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
};

module.exports = config;
