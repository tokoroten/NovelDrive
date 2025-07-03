#!/bin/bash

# Install dependencies script for NovelDrive
# This script handles dependency installation with proper permissions

echo "Installing NovelDrive dependencies..."

# Create a temporary directory for installation
TEMP_DIR="/tmp/noveldrive-install-$$"
mkdir -p "$TEMP_DIR"

# Copy necessary files
cp package.json "$TEMP_DIR/"
cd "$TEMP_DIR"

# Install dependencies
npm install --save-dev electron@latest typescript @types/node
npm install better-sqlite3

# Copy back node_modules
echo "Copying dependencies back to project..."
cp -r node_modules/* /mnt/c/Users/shinta/Documents/GitHub/NovelDrive/node_modules/ 2>/dev/null || true

# Clean up
cd /
rm -rf "$TEMP_DIR"

echo "Dependencies installed successfully!"