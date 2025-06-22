#!/bin/bash

# Multi-Agent Discussion System Test Runner
# This script runs the comprehensive test suite for the multi-agent discussion functionality

echo "🚀 Starting Multi-Agent Discussion System Tests..."
echo "=================================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please make sure OPENAI_API_KEY is set."
    exit 1
fi

# Load environment variables
source .env

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY is not set in .env file."
    exit 1
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run TypeScript compilation
echo "🔨 Compiling TypeScript..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed."
    exit 1
fi

# Run the test suite
echo "🧪 Running Multi-Agent Discussion Tests..."
npx tsx src/main/commands/test-multi-agent-discussion.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ All tests completed successfully!"
else
    echo "❌ Some tests failed. Please check the output above."
    exit 1
fi

echo "=================================================="
echo "🎉 Test execution completed!"