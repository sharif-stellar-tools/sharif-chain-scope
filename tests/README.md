# Testing Guide

## Overview

This project uses **Jest** and **nock** for reliable, offline unit testing. Tests no longer depend on live Horizon API connections, making them fast and reliable.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Generate coverage report
npm test:coverage
```

## Mock Setup

### Fixtures

Mock data is stored in `tests/fixtures/`:

- **operations.json** - Real Horizon API response structure with sample operations (payments, sell offers, etc.)

### Mocking Library: nock

We use **nock** to intercept HTTP requests and return mock responses. This allows tests to:
- Run completely offline
- Execute significantly faster
- Return consistent data on every run
- Avoid flaky network-dependent tests

### Key Test Files

#### `tests/integration/horizonMock.test.ts`
Tests for mocking Horizon API responses:
- Fetching operations from mock server
- Handling multiple operation types
- Error response mocking
- Offline execution verification

#### `tests/hooks/useTransactionHistory.test.ts`
Tests for transaction history functionality using mock data:
- Loading fixtures correctly
- Filtering by operation type
- Data structure validation
- Horizon API response format compliance

## Adding New Tests

### Creating a New Mock Fixture

1. Add a new JSON file to `tests/fixtures/`
2. Include the complete Horizon API response structure:

```json
{
  "_links": { ... },
  "_embedded": {
    "records": [ ... ]
  }
}
```

### Writing Tests with Mocks

```typescript
import nock from 'nock';
import { loadFixture } from './mocks/horizonMock';

describe('My Feature', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  test('should work with mocked API', async () => {
    const fixture = loadFixture('operations.json');
    
    nock('https://horizon.stellar.org')
      .get('/operations?limit=50&order=desc')
      .reply(200, fixture);

    // Your test code here
  });
});
```

## Coverage

The project maintains an 85%+ code coverage requirement:

```bash
npm run test:coverage
```

## Benefits of Mock-Based Testing

✅ **Fast**: No network delays  
✅ **Reliable**: No flaky network failures  
✅ **Offline**: Run tests anywhere  
✅ **Consistent**: Same data every time  
✅ **Maintainable**: Easy to add new scenarios  
