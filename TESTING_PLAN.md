# Automated Testing Plan for GCPG Podcast Generation System

## Executive Summary

This document outlines a **fully automated testing strategy** for the GCPG podcast generation system. All tests are designed to run automatically in GitHub Actions CI/CD pipelines and Claude Code environments without any manual intervention. The plan covers unit, integration, and end-to-end testing across both frontend (React/TypeScript) and backend (Node.js/Express) components.

**Key Automation Principles:**
- ✅ All tests run headlessly (no browser windows, no manual clicks)
- ✅ All external services are mocked (Gemini, Perplexity, Google Cloud APIs)
- ✅ Firebase emulators start/stop automatically
- ✅ Tests execute in parallel for speed
- ✅ Zero manual setup required after initial configuration
- ✅ Same test commands work locally and in CI

## Current State Analysis

**No existing tests:**
- Backend: `"test": "echo \"Error: no test specified\" && exit 1"`
- Frontend: No test script defined
- No test framework configured
- No test files present

**Existing quality checks (in PR workflow):**
- ✅ TypeScript compilation
- ✅ ESLint (frontend only)
- ✅ Build verification

## Automation Requirements

### Running Tests Locally (Claude Code or Developer Machine)

**One-time setup:**
```bash
# Install dependencies
npm run install:all

# Install Firebase emulators (only needed for E2E tests)
npm install -g firebase-tools

# Install Playwright browsers (only needed for E2E tests)
cd e2e && npx playwright install --with-deps chromium
```

**Running tests:**
```bash
# Backend tests (unit + integration)
cd backend && npm test

# Frontend tests (unit + component)
cd frontend && npm test

# E2E tests (full system)
npm run test:e2e

# All tests with coverage
npm run test:all
```

**Auto-watch mode for development:**
```bash
cd backend && npm run test:watch
cd frontend && npm run test:watch
```

### Running Tests in GitHub Actions

**Fully automated on every PR:**
- Tests run automatically when PR is opened/updated
- Firebase emulators start automatically
- All external services are mocked
- Coverage reports generated and uploaded
- PR blocked if tests fail or coverage drops

**No secrets required for tests:**
- Mock API keys used for all external services
- Firestore emulator requires no credentials
- Firebase Auth emulator requires no credentials

## Testing Strategy Overview

### 1. Testing Pyramid Approach

```
           /\
          /E2E\         10% - Critical user flows
         /------\
        /Integration\   30% - API & service integration
       /------------\
      /  Unit Tests  \  60% - Business logic & utilities
     /----------------\
```

### 2. Test Coverage Goals

**Phase 1 (MVP):** 40% overall coverage
- Backend services: 60%
- Backend routes: 50%
- Frontend utilities: 50%
- Frontend components: 30%

**Phase 2 (Production-ready):** 70% overall coverage
**Phase 3 (Mature):** 80%+ overall coverage

## Technology Stack Recommendations

### Backend Testing
- **Framework:** Jest
- **HTTP Testing:** Supertest
- **Mocking:** Jest built-in mocks + Firebase Admin SDK testing utilities
- **Coverage:** Jest built-in coverage

**Rationale:** Jest is the de facto standard for Node.js, has excellent TypeScript support, and integrates well with Firebase.

### Frontend Testing
- **Framework:** Vitest (optimized for Vite projects)
- **Component Testing:** React Testing Library
- **User Interactions:** @testing-library/user-event
- **Mocking:** MSW (Mock Service Worker) for API mocking
- **Coverage:** Vitest built-in coverage

**Rationale:** Vitest is the fastest test runner for Vite projects, 5-10x faster than Jest for this use case.

### E2E Testing
- **Framework:** Playwright
- **Test Environment:** Real Firebase Auth + Firestore emulator

**Rationale:** Playwright offers better DX, parallel testing, and built-in retry/debugging vs Cypress.

## Testing Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

#### 1.1 Backend Unit Tests
**Priority: HIGH**

Test coverage for critical services:

```
backend/src/services/
├── database.test.ts          # CRUD operations with Firestore mock
├── audio.test.ts             # TTS integration with GCP mock
├── contentFormatter.test.ts  # Text formatting logic
├── episodeAnalyzer.test.ts   # Episode analysis utilities
└── rssGenerator.test.ts      # RSS feed generation
```

**Testing approach:**
- Mock Firestore using `@google-cloud/firestore` test utilities
- Mock Google Cloud TTS API
- Test business logic in isolation
- Validate data transformations

**Example test structure:**
```typescript
// database.test.ts
describe('Database Service', () => {
  describe('getAllPodcasts', () => {
    it('should return public podcasts for anonymous users', async () => {
      // Test public/private visibility logic
    });

    it('should return user podcasts for authenticated users', async () => {
      // Test user filtering
    });
  });

  describe('createEpisode', () => {
    it('should create episode with proper timestamps', async () => {
      // Test creation logic
    });

    it('should throw error for invalid podcast ID', async () => {
      // Test error handling
    });
  });
});
```

#### 1.2 Backend Route Integration Tests
**Priority: HIGH**

```
backend/src/routes/
├── podcasts.test.ts     # API endpoint testing
├── admin.test.ts        # Admin operations
└── episodeLogs.test.ts  # Log retrieval
```

**Testing approach:**
- Use Supertest for HTTP assertions
- Mock authentication middleware
- Mock external services (Gemini, Perplexity, GCP)
- Test request validation & error handling

**Example:**
```typescript
// podcasts.test.ts
describe('POST /api/podcasts', () => {
  it('should create podcast for authenticated user', async () => {
    const response = await request(app)
      .post('/api/podcasts')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({
        title: 'Test Podcast',
        description: 'Test description',
        podcastType: 'briefing'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('Test Podcast');
  });

  it('should return 401 for unauthenticated request', async () => {
    await request(app)
      .post('/api/podcasts')
      .send({ title: 'Test' })
      .expect(401);
  });
});
```

#### 1.3 Frontend Unit Tests
**Priority: MEDIUM**

```
frontend/src/
├── services/api.test.ts       # API client functions
├── contexts/AuthContext.test.tsx  # Auth state management
└── utils/                     # Utility functions (if created)
```

**Testing approach:**
- Mock fetch API using MSW
- Test auth token handling
- Test error scenarios

#### 1.4 Setup Test Infrastructure

**Backend setup:**
```json
// backend/package.json additions
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0"
  }
}
```

**Frontend setup:**
```json
// frontend/package.json additions
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@vitest/ui": "^1.2.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "msw": "^2.0.0",
    "@vitest/coverage-v8": "^1.2.0"
  }
}
```

**Root package.json scripts (for running all tests):**
```json
// package.json additions
{
  "scripts": {
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "cd backend && npm test",
    "test:frontend": "cd frontend && npm test",
    "test:e2e": "playwright test",
    "test:all": "npm run test && npm run test:e2e",
    "test:ci": "npm run test:backend -- --ci && npm run test:frontend -- run && npm run test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "firebase-tools": "^13.0.0"
  }
}
```

**Configuration files:**
- `backend/jest.config.js` - Jest configuration
- `frontend/vitest.config.ts` - Vitest configuration
- `frontend/src/setupTests.ts` - Test setup (RTL, MSW)
- `playwright.config.ts` - Playwright E2E config (headless mode)
- `e2e/global-setup.ts` - Auto-start Firebase emulators
- `e2e/global-teardown.ts` - Auto-stop emulators

### Phase 2: Component & Integration Tests (Week 3-4)

#### 2.1 Frontend Component Tests
**Priority: HIGH**

```
frontend/src/components/
├── PodcastList.test.tsx        # List rendering, filtering
├── PodcastDetail.test.tsx      # Detail view, actions
├── TopicSelector.test.tsx      # Topic selection flow
├── GenerationLogViewer.test.tsx # Log display
├── AudioPlayer.test.tsx        # Playback controls
└── Login.test.tsx              # Auth flow
```

**Testing approach:**
- Render components with RTL
- Test user interactions
- Mock API responses with MSW
- Test loading/error states

**Example:**
```typescript
// PodcastList.test.tsx
describe('PodcastList', () => {
  it('should display loading state', () => {
    render(<PodcastList />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render podcasts after fetch', async () => {
    const mockPodcasts = [
      { id: '1', title: 'Tech Briefing', description: 'Daily tech news' }
    ];

    server.use(
      http.get('/api/podcasts', () => HttpResponse.json(mockPodcasts))
    );

    render(<PodcastList />);

    await waitFor(() => {
      expect(screen.getByText('Tech Briefing')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    server.use(
      http.get('/api/podcasts', () => HttpResponse.error())
    );

    render(<PodcastList />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

#### 2.2 Advanced Service Tests

Test complex business logic:

```
backend/src/services/
├── hybridTopicService.test.ts     # Topic generation with AI mocks
├── searchOrchestrator.test.ts     # Search coordination
├── deepDiveResearch.test.ts       # Research pipeline
├── narrativePlanner.test.ts       # Content planning
└── clusteringService.test.ts      # K-means clustering
```

**Testing approach:**
- Mock AI APIs (Gemini, Perplexity) with fixtures
- Test retry logic and error handling
- Test data transformations
- Validate output formats

#### 2.3 Middleware Tests

```
backend/src/middleware/
└── auth.test.ts    # Firebase token verification
```

### Phase 3: E2E Tests (Week 5-6)

#### 3.1 Critical User Flows (Fully Automated)

```
e2e/
├── auth.spec.ts                  # Login flow
├── podcast-creation.spec.ts      # Create podcast
├── episode-generation.spec.ts    # Generate episode (with timeout)
└── playback.spec.ts              # Play episode audio
```

**Fully automated testing approach:**
- ✅ Playwright runs in **headless mode** (no visible browser)
- ✅ Firebase emulators start/stop automatically via setup scripts
- ✅ All external APIs mocked (Gemini, Perplexity, GCP TTS, GCP Storage)
- ✅ Tests run in parallel across multiple workers
- ✅ Auto-retry on flaky tests (3 retries max)
- ✅ Screenshots captured on failure for debugging
- ✅ Tests complete in ~2-3 minutes total
- ✅ Works identically in CI and locally

**Example:**
```typescript
// episode-generation.spec.ts
test('should generate episode with topic selection', async ({ page }) => {
  await page.goto('/');

  // Login
  await page.click('text=Sign In');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.click('button:has-text("Continue")');

  // Select podcast
  await page.click('text=Tech Briefing');

  // Generate episode
  await page.click('button:has-text("Generate Episode")');

  // Select topic within 90s timeout
  await page.waitForSelector('.topic-option', { timeout: 95000 });
  await page.click('.topic-option:first-child');

  // Wait for generation
  await expect(page.locator('.episode-title')).toBeVisible({ timeout: 120000 });
});
```

#### 3.2 E2E Infrastructure (Automated Setup/Teardown)

**Automated setup files:**
- `playwright.config.ts` - Headless mode, retries, parallel workers
- `e2e/global-setup.ts` - **Automatically starts Firebase emulators**
- `e2e/global-teardown.ts` - **Automatically stops emulators and cleans up**
- `e2e/fixtures.ts` - Shared test data and mocks

**Example global-setup.ts (runs before all E2E tests):**
```typescript
import { spawn } from 'child_process';

export default async function globalSetup() {
  console.log('Starting Firebase emulators...');

  // Start emulators in background
  const emulatorProcess = spawn('firebase', [
    'emulators:start',
    '--only', 'auth,firestore',
    '--project', 'demo-test'
  ]);

  // Wait for emulators to be ready
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Store process ID for cleanup
  process.env.EMULATOR_PID = emulatorProcess.pid.toString();

  console.log('Emulators ready!');
}
```

**Automated external service mocking:**
- Mock server runs automatically via `globalSetup`
- Gemini API mocked with predictable responses
- Perplexity API mocked with fixture data
- GCP TTS returns static test audio files
- GCP Storage operations return success without actual uploads

### Phase 4: CI/CD Integration (Week 7)

#### 4.1 Fully Automated GitHub Actions Workflow

**Zero-touch automation:** All tests run automatically on every PR/push without any manual steps.

Update `.github/workflows/pr-checks.yml` to add automated testing:

```yaml
frontend-checks:
  # ... existing steps ...

  - name: Run tests
    working-directory: frontend
    run: npm run test:ci

  - name: Upload coverage
    uses: codecov/codecov-action@v3
    with:
      files: ./frontend/coverage/lcov.info
      flags: frontend

backend-checks:
  # ... existing steps ...

  - name: Run tests
    working-directory: backend
    run: npm run test:ci

  - name: Upload coverage
    uses: codecov/codecov-action@v3
    with:
      files: ./backend/coverage/lcov.info
      flags: backend

e2e-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm run install:all

    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium

    - name: Run E2E tests
      run: npm run test:e2e
      env:
        CI: true
        # Emulators start automatically via globalSetup
        # All external APIs mocked automatically
        # No secrets needed!

    - name: Upload Playwright report
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7

    - name: Upload screenshots on failure
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: test-failure-screenshots
        path: e2e/screenshots/
        retention-days: 7
```

#### 4.2 Coverage Requirements

Set minimum coverage thresholds in CI:

```javascript
// backend/jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    }
  }
};
```

```typescript
// frontend/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40
      }
    }
  }
});
```

## Test Data Management

### Mock Data Strategy

**Create centralized fixtures:**
```
tests/fixtures/
├── podcasts.ts      # Sample podcast data
├── episodes.ts      # Sample episode data
├── users.ts         # Sample user data
└── ai-responses.ts  # Mock AI responses
```

**Example:**
```typescript
// tests/fixtures/podcasts.ts
export const mockPodcast = {
  id: 'test-podcast-1',
  title: 'Tech Briefing',
  description: 'Daily tech news',
  podcastType: 'briefing',
  visibility: 'public' as const,
  ownerEmail: 'test@example.com',
  episodes: [],
  autoGenerate: false
};
```

### External Service Mocking

**Gemini API:**
- Mock using Jest/Vitest mocks
- Return predictable responses for topic generation
- Test error scenarios (rate limits, timeouts)

**Perplexity API:**
- Mock HTTP requests using nock (backend) or MSW (frontend)
- Provide fixture-based responses

**Google Cloud Services:**
- Use official test utilities where available
- Mock Storage SDK for audio operations
- Mock Firestore with in-memory implementation

## Testing Best Practices

### 1. Test Isolation
- Each test should be independent
- Use beforeEach/afterEach for setup/cleanup
- Reset mocks between tests

### 2. Descriptive Test Names
```typescript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should return 401 when auth token is missing', () => { ... });
```

### 3. AAA Pattern
```typescript
it('should create podcast', async () => {
  // Arrange
  const podcastData = { title: 'Test', description: 'Test desc' };

  // Act
  const result = await createPodcast(podcastData);

  // Assert
  expect(result).toHaveProperty('id');
  expect(result.title).toBe('Test');
});
```

### 4. Test Coverage != Quality
- Focus on testing critical paths
- Test edge cases and error scenarios
- Don't chase 100% coverage blindly

### 5. Avoid Testing Implementation Details
```typescript
// ❌ Bad - testing internal state
expect(component.state.isLoading).toBe(true);

// ✅ Good - testing user-visible behavior
expect(screen.getByText('Loading...')).toBeInTheDocument();
```

## Specific Test Scenarios

### High-Priority Tests

#### Backend

**Database Service:**
- ✅ Create podcast with required fields
- ✅ Update podcast visibility
- ✅ Filter podcasts by user/visibility
- ✅ Create episode with narrativeStructure
- ✅ Delete cascade (podcast → episodes)

**Audio Service:**
- ✅ Generate TTS audio
- ✅ Upload to Cloud Storage
- ✅ Handle large text (chunking)
- ✅ Error handling for API failures

**Topic Generation:**
- ✅ Generate topic options via Gemini
- ✅ Fallback to Perplexity on Gemini failure
- ✅ Topic selection timeout logic
- ✅ Deduplication of similar topics

**Episode Generation Flow:**
- ✅ Full pipeline: topic → research → content → TTS
- ✅ Log generation at each stage
- ✅ Error recovery and logging
- ✅ Content differentiation from previous episodes

#### Frontend

**Authentication:**
- ✅ Login flow with Firebase
- ✅ Token refresh
- ✅ Protected route redirection
- ✅ Logout

**Podcast Management:**
- ✅ List podcasts (public + user's)
- ✅ Create podcast form validation
- ✅ Toggle visibility
- ✅ Delete podcast with confirmation

**Episode Generation:**
- ✅ Topic selection UI
- ✅ Countdown timer (90s)
- ✅ Auto-generation status display
- ✅ Generation log streaming

**Audio Playback:**
- ✅ Play/pause controls
- ✅ Progress bar
- ✅ Error handling for missing audio

### Medium-Priority Tests

**Backend:**
- RSS feed generation
- Episode clustering
- Content formatting
- Source management
- Admin operations

**Frontend:**
- Episode list filtering
- Responsive layout
- Theme application
- Error boundaries

### Low-Priority Tests

- Migration scripts
- Cron job handlers
- Logging utilities

## Performance Testing Considerations

**Not included in initial plan but recommended for future:**

1. **Load Testing** (Artillery or k6)
   - Concurrent episode generation
   - API response times under load

2. **AI API Rate Limiting**
   - Test retry logic
   - Test backoff strategies

3. **Large Data Sets**
   - Podcast with 100+ episodes
   - Firestore query performance

## Security Testing

**Include in integration tests:**

1. **Authentication:**
   - ✅ Test invalid tokens
   - ✅ Test expired tokens
   - ✅ Test missing Authorization header

2. **Authorization:**
   - ✅ User can't access other user's private podcasts
   - ✅ User can't modify other user's podcasts
   - ✅ Admin-only routes protected

3. **Input Validation:**
   - ✅ XSS prevention in podcast titles
   - ✅ SQL injection (n/a for Firestore, but test input sanitization)
   - ✅ Rate limiting on episode generation

## Documentation Requirements

1. **Testing Guide** (`TESTING.md`)
   - How to run tests locally
   - How to write new tests
   - Mocking strategies
   - Debugging failed tests

2. **Code Comments**
   - Complex test scenarios should be documented
   - Mock setup should explain why specific data is used

3. **CI/CD Documentation**
   - Update README with test badge
   - Document coverage requirements

## Success Metrics

### Week 2
- ✅ 20+ backend unit tests passing
- ✅ 50% coverage in database service
- ✅ Tests running in CI

### Week 4
- ✅ 50+ total tests (backend + frontend)
- ✅ 40% overall coverage
- ✅ All API routes tested

### Week 6
- ✅ 80+ total tests
- ✅ E2E tests for critical flows
- ✅ 60% overall coverage

### Week 8
- ✅ 100+ total tests
- ✅ 70% overall coverage
- ✅ All tests passing in CI
- ✅ Coverage reports integrated

## Estimated Effort

**By developer skill level:**

**1 experienced developer:**
- Phase 1: 10-12 hours
- Phase 2: 12-15 hours
- Phase 3: 8-10 hours
- Phase 4: 3-5 hours
- **Total: 33-42 hours (5-6 days)**

**Team of 2 (parallel work):**
- One on backend, one on frontend
- **Total: 3-4 days**

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase emulator setup complexity | Medium | Provide detailed setup guide, use docker-compose |
| AI API mocking difficulty | High | Create comprehensive fixture library early |
| Test flakiness in E2E | High | Use Playwright's auto-retry, avoid hard timeouts |
| Coverage slows down development | Medium | Set realistic thresholds, allow exceptions |
| Developers skip writing tests | High | Make tests required in PR checks, code review enforcement |

## Automation Summary

**This testing plan is 100% automated - no manual testing required!**

### Running Tests in Claude Code
```bash
# Simple commands that work every time
npm test              # Run all unit tests
npm run test:e2e      # Run E2E tests (emulators auto-start)
npm run test:all      # Run everything
```

### Running Tests in GitHub Actions
- **Trigger:** Automatic on every PR/push to main
- **Setup:** Zero - emulators and mocks start automatically
- **Secrets:** None required for tests
- **Runtime:** ~3-5 minutes total
- **Blocking:** PR cannot merge if tests fail

### What Gets Automated
✅ **Unit tests** - Business logic, services, utilities
✅ **Integration tests** - API endpoints with mocked dependencies
✅ **Component tests** - React components with user interactions
✅ **E2E tests** - Full user flows in headless browser
✅ **Coverage reports** - Automatically generated and enforced
✅ **Firebase emulators** - Auto-start/stop
✅ **External API mocking** - Gemini, Perplexity, GCP services
✅ **Failure screenshots** - Captured automatically for debugging
✅ **Parallel execution** - Tests run in parallel for speed
✅ **Auto-retry** - Flaky tests retry automatically (3x)

### Developer Experience
**Write once, run anywhere:**
- Same commands work locally and in CI
- No environment-specific configuration
- Instant feedback in watch mode
- Clear error messages with stack traces
- Coverage displayed in terminal and uploaded to Codecov

**Time Investment:**
- Initial setup: ~2 hours
- Per test: ~5-10 minutes
- Total for full suite: ~40 hours
- **ROI:** Catches bugs before production, saves hours of manual testing

## Recommendations

### Immediate Actions (Week 1)
1. ✅ Install Jest and Vitest
2. ✅ Create basic config files
3. ✅ Write first 5 tests (database service)
4. ✅ Add test command to package.json
5. ✅ Update CI workflow

### Quick Wins
- Test utilities and pure functions first (easiest, highest ROI)
- Add tests for recent bugs to prevent regression
- Test auth middleware (critical for security)

### Anti-Patterns to Avoid
- ❌ Don't mock everything (balance with integration tests)
- ❌ Don't test external libraries (trust them)
- ❌ Don't duplicate TypeScript's type checking in tests
- ❌ Don't write brittle snapshot tests for everything

## Appendix: Useful Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Testing Firebase](https://firebase.google.com/docs/emulator-suite)

### Testing Philosophy
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Example Projects
- [Firebase Testing Example](https://github.com/firebase/quickstart-testing)
- [React + Vitest Setup](https://github.com/vitest-dev/vitest/tree/main/examples/react-testing-lib)

---

**Next Steps:** Review this plan, prioritize based on your immediate needs, and approve the approach. I can then begin implementation starting with Phase 1.
