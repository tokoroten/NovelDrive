# E2E Tests for NovelDrive

This directory contains end-to-end tests for the NovelDrive Electron application using Playwright.

## Structure

```
e2e/
├── tests/              # Test files
├── fixtures/           # Test data and fixtures
├── utils/              # Helper utilities
└── README.md          # This file
```

## Running Tests

### Local Development

```bash
# Run all tests
npm run test:e2e

# Run tests with visible browser
npm run test:e2e:headed

# Debug tests interactively
npm run test:e2e:debug

# Open Playwright UI mode
npm run test:e2e:ui
```

### CI Environment

```bash
# Run in headless mode for CI
npm run test:e2e:headless
```

## Writing Tests

1. Create test files in `e2e/tests/` with `.spec.ts` extension
2. Use the `ElectronHelpers` utility class for common operations
3. Add test data to `e2e/fixtures/test-data.ts`
4. Use data-testid attributes for reliable element selection

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { ElectronHelpers } from '../utils/electron-helpers';

test.describe('Feature Name', () => {
  let electronHelpers: ElectronHelpers;

  test.beforeEach(async () => {
    electronHelpers = new ElectronHelpers();
    await electronHelpers.launchApp();
  });

  test.afterEach(async () => {
    await electronHelpers.closeApp();
  });

  test('should do something', async () => {
    // Your test code here
  });
});
```

## Best Practices

1. **Use data-testid attributes**: Add `data-testid` to elements in the application for reliable selection
2. **Wait for elements**: Always wait for elements before interacting with them
3. **Handle async operations**: Use proper waits for API calls and animations
4. **Clean up**: Always close the app in afterEach hooks
5. **Isolate tests**: Each test should be independent and not rely on others

## Debugging Failed Tests

1. Use `npm run test:e2e:debug` to step through tests
2. Check screenshots in the test results
3. Review video recordings for failed tests
4. Use `console.log` in tests for additional debugging
5. Check the Playwright report: `npx playwright show-report`

## CI Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests

Test results and artifacts are uploaded to GitHub Actions for review.