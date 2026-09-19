module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.test.mjs', '<rootDir>/tests/**/*.test.jsx'],
  transform: { '^.+\\.(m?js|jsx)$': ['babel-jest', { presets: ['next/babel'] }] },
  transformIgnorePatterns: ['/node_modules/(?!ical.js/)'],
  clearMocks: true,
};
