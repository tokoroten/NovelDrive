# Multi-Agent Discussion System Testing

This document describes the comprehensive test suite for NovelDrive's multi-agent discussion system.

## Overview

The multi-agent discussion system is a core component of NovelDrive that enables AI agents to collaborate on novel creation through structured discussions. The test suite validates all aspects of this system including agent initialization, discussion flow, evaluation system, and data persistence.

## Test Components

### 1. Agent Initialization Test
- Verifies that all four agents (Writer, Editor, Proofreader, Deputy Editor) are properly initialized
- Checks agent properties (ID, role, name) are correctly set
- Validates DiscussionManager setup

### 2. Discussion Flow Test
- Tests the correct ordering of agent participation (Writer → Editor → Proofreader → Deputy Editor)
- Verifies discussion structure and metadata
- Validates message flow and timing

### 3. Evaluation System Test
- Tests the Deputy Editor's evaluation parsing functionality
- Verifies scoring system (narrative completeness, marketability, originality)
- Validates recommendation logic (accept/revise/reject)
- Tests evaluation criteria parsing

### 4. Database Persistence Test
- Verifies discussions are properly saved to database
- Tests message persistence and retrieval
- Validates data integrity after save/load cycles

### 5. Pause/Resume Functionality Test
- Tests discussion pause and resume capabilities
- Verifies state transitions (active → paused → active)
- Validates system behavior during pause/resume

### 6. Human Intervention Test
- Tests the ability to inject human feedback into ongoing discussions
- Verifies message attribution and metadata
- Validates system response to human input

### 7. API Usage Logging Test
- Tests comprehensive API usage tracking
- Verifies cost calculation and token counting
- Tests error logging functionality
- Validates log retrieval and filtering

## Running the Tests

### Prerequisites

1. **Environment Setup**: Ensure you have a `.env` file with:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install
   ```

### Execution Methods

#### Method 1: Using npm script (Recommended)
```bash
npm run test:agents
```

#### Method 2: Using the shell script
```bash
./scripts/run-agent-tests.sh
```

#### Method 3: Direct execution
```bash
npx tsx src/main/commands/test-multi-agent-discussion.ts
```

## Test Features

### Mock Data Usage
The test suite uses mock data to avoid unnecessary API calls during testing:
- Mock discussions with realistic agent conversations
- Mock evaluation responses with proper formatting
- Mock API responses for cost calculation testing

### In-Memory Database
Tests use an in-memory DuckDB instance to:
- Avoid affecting production data
- Enable fast test execution
- Provide clean test environments

### Comprehensive Coverage
The test suite covers:
- ✅ Happy path scenarios
- ✅ Error handling
- ✅ Edge cases
- ✅ Performance metrics
- ✅ Data validation
- ✅ API integration points

## Test Output

The test suite provides detailed output including:

```
🚀 Starting Multi-Agent Discussion System Tests...

🔧 Testing agent initialization...
✅ Agent initialization test passed

🗣️ Testing discussion flow...
✅ Discussion flow test passed

🎯 Testing evaluation system...
✅ Evaluation system test passed

💾 Testing database persistence...
✅ Database persistence test passed

⏸️ Testing pause/resume functionality...
✅ Pause/resume functionality test passed

👤 Testing human intervention...
✅ Human intervention test passed

📊 Testing API usage logging...
✅ API usage logging test passed

============================================================
📋 MULTI-AGENT DISCUSSION SYSTEM TEST RESULTS
============================================================

✅ Passed: 7
❌ Failed: 0
📊 Total: 7

📈 Performance Summary:
   Total Duration: 1250ms
   Average Duration: 178ms
   Success Rate: 100%

🎉 All tests passed! Multi-agent discussion system is working correctly.
```

## Integration with Development Workflow

### Continuous Integration
The test can be integrated into CI/CD pipelines:
```yaml
# Example GitHub Actions step
- name: Test Multi-Agent System
  run: npm run test:agents
```

### Pre-commit Hooks
Add to git hooks for automated testing:
```bash
#!/bin/sh
npm run test:agents
```

### Development Testing
Run tests during development to ensure system integrity:
```bash
# Quick test during development
npm run test:agents

# Type checking before testing
npm run typecheck && npm run test:agents
```

## Troubleshooting

### Common Issues

1. **Missing OpenAI API Key**
   ```
   Error: OPENAI_API_KEY environment variable is required
   ```
   **Solution**: Add your OpenAI API key to `.env` file

2. **TypeScript Compilation Errors**
   ```
   TypeScript compilation failed
   ```
   **Solution**: Run `npm run typecheck` to identify and fix type issues

3. **Database Connection Issues**
   ```
   Database setup failed
   ```
   **Solution**: Ensure DuckDB is properly installed in dependencies

4. **Test Timeouts**
   ```
   Test execution timed out
   ```
   **Solution**: Check network connectivity and API rate limits

### Debug Mode

For detailed debugging, modify the test script to enable verbose logging:
```typescript
// Set environment variable for debug mode
process.env.DEBUG = 'true';
```

## Performance Considerations

### Test Execution Time
- Expected execution time: 1-3 seconds (using mocks)
- With actual API calls: 30-60 seconds
- Database operations: < 100ms per test

### Resource Usage
- Memory: ~50MB for in-memory database
- Disk: Minimal (temporary files only)
- Network: None (when using mocks)

## Future Enhancements

### Planned Improvements
1. **Stress Testing**: Test with high-volume discussions
2. **Concurrency Testing**: Multiple simultaneous discussions
3. **Performance Benchmarking**: Detailed performance metrics
4. **Visual Test Reports**: HTML/JSON test reporting
5. **Integration Testing**: End-to-end workflow testing

### Test Data Expansion
- More diverse discussion scenarios
- Edge case conversations
- Error condition simulations
- Multi-language testing support

## Contributing

When adding new features to the multi-agent system:

1. **Add corresponding tests** to the test suite
2. **Update mock data** if new data structures are introduced
3. **Verify test coverage** includes new functionality
4. **Update documentation** to reflect changes

## Related Documentation

- [AI Behavior Specification](./ai-behavior-spec.md)
- [Multi-Agent System Architecture](./concept.md)
- [Database Schema](./specifications.md)
- [API Usage Guidelines](./development-guidelines.md)