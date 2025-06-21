# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NovelDrive (小説執筆エンジン) is an AI-powered novel writing engine that mimics human creative memory and ideation processes. The project is currently in the conceptual phase with implementation planned in TypeScript.

## Technology Stack

- **Language**: TypeScript (unified for frontend/backend)
- **Desktop Framework**: Electron
- **Database**: DuckDB WASM
- **Japanese Processing**: TinySegmenter
- **Vector Search**: Vectra or Voy (TypeScript native)
- **Full-text Search**: DuckDB FTS with Japanese tokenizer

## Development Commands

Since the project is not yet implemented, here are the planned/expected commands:

```bash
# Initial setup (once implemented)
npm install

# Development
npm run dev        # Start Electron app in development mode
npm run build      # Build production version
npm run test       # Run tests
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
```

## Architecture Overview

### Multi-Agent System
The system consists of multiple AI agents working in hierarchy:
1. **Editor-in-Chief** (User) - Makes final decisions
2. **Deputy Editor AI** - Analyzes narrative, raises potential issues
3. **Writer AI & Editor AI** - Collaborate through discussion
4. **Critic AI** - Proofreads and verifies consistency

### Core Components

1. **Memory & Emergence System**
   - Hierarchical information abstraction (Detail → Episode → Theme → Meta)
   - Time-decay based probabilistic access
   - Association networks for creative connections

2. **Fact Tracking System**
   - Character settings and development tracking
   - Timeline and location management
   - World-building rules and consistency checking
   - Foreshadowing management

3. **Idea Management System**
   - "Anything Box" for unclassified ideas
   - Idea maturation over time
   - Chemical reaction generator for combining ideas
   - Context-aware idea retrieval

4. **Data Storage**
   - DuckDB for structured data and full-text search
   - Vector embeddings for semantic similarity
   - JSON storage for flexible schemas

## Implementation Phases

**Phase 1**: Foundation
- Electron + TypeScript setup
- DuckDB WASM integration
- Basic idea management UI

**Phase 2**: AI Implementation
- Agent dialogue systems
- Real-time consistency checking
- Basic memory mechanisms

**Phase 3**: Advanced Features
- Vector search integration
- Fuzzy memory implementation
- Chemical reaction generator

**Phase 4**: UX Enhancement
- Polished UI
- Performance optimization
- User feedback integration

## Key Design Principles

1. **Mimic Human Creativity**: Implement "vague memory" that allows for serendipitous connections
2. **Japanese-First**: Optimize for Japanese text processing and writing conventions
3. **Local-First**: All data processing happens locally for privacy and offline capability
4. **Emergence Over Determinism**: Allow unexpected connections rather than rigid rule-following

## Important Considerations

- The project aims to solve the "overly context-aware LLM" problem by implementing controlled randomness
- All text processing must handle Japanese correctly (tokenization, search, etc.)
- The system should support parallel world/timeline management for complex narratives
- Performance is critical - the system must be responsive during real-time writing

## Reference Documentation

See `docs/concept.md` for the detailed project concept and design philosophy.