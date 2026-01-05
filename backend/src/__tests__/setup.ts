// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.PORT = '8080';

// Suppress console.log during tests (optional, can be removed if needed)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
