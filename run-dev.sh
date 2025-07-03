#!/bin/bash

# Development run script for NovelDrive on Linux/WSL
echo "Starting NovelDrive in development mode..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Please run ./install-deps.sh first"
    exit 1
fi

# Export display for WSL
export DISPLAY=${DISPLAY:-:0}

# Run Electron
echo "Starting Electron app..."
NODE_ENV=development npx electron . 2>&1 | tee electron.log

echo "Application closed."