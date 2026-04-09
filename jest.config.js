/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    // stub chrome API for tests
    '^../shared/storage$': '<rootDir>/tests/__mocks__/storage.ts',
    '^../shared/messaging$': '<rootDir>/tests/__mocks__/messaging.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'ES2022',
        module: 'CommonJS',
        moduleResolution: 'node',
        strict: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    },
  },
};
