# Changelog

All notable changes to NovelDrive will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-23

### 🎉 Initial Release - Feature Complete

This is the first major release of NovelDrive, a two-layer creative writing platform that combines serendipitous knowledge management with multi-agent novel creation.

### Added

#### Core Features
- **Enhanced Writing Editor**
  - AI-powered writing suggestions
  - Real-time character and word counting
  - Auto-save with visual indicators
  - Distraction-free writing mode
  - Chapter navigation sidebar

- **24-Hour Autonomous Mode**
  - Background content generation
  - Quality threshold filtering
  - Human approval queue
  - Activity logging and metrics
  - Configurable generation limits

- **Backup & Restore System**
  - Manual backup creation with descriptions
  - Automatic scheduled backups
  - Point-in-time restoration
  - Transaction-safe restore process
  - Backup history management

- **Version History**
  - Document version tracking
  - Visual diff comparison
  - Version restoration
  - Change descriptions
  - Automatic version creation on save

- **Export Functionality**
  - Plain text (.txt) export
  - Markdown (.md) export
  - Batch export capabilities
  - Metadata inclusion options
  - Document filtering and search

- **Plot Branching Management**
  - Visual plot tree display
  - Branch creation from existing plots
  - Plot merging with multiple strategies
  - Status tracking (draft, active, archived, merged)
  - Three layout modes (force, hierarchical, circular)

- **Serendipity Search Enhancement**
  - Three visualization modes:
    - List view with statistics
    - Bubble view with dynamic sizing
    - Constellation view with connections
  - Real-time search progress animation
  - Serendipity factor visualization
  - Search history and saved results
  - Advanced filtering options

- **Character Relationship Diagram**
  - Interactive relationship graph
  - Seven relationship types
  - Relationship strength visualization
  - Character metadata display
  - Statistics and analytics panel
  - Add/edit relationships UI

- **Analytics Dashboard**
  - Four comprehensive tabs:
    - Overview with key metrics
    - Productivity analysis with heatmaps
    - Cost tracking for API usage
    - Goal management and tracking
  - Writing streak tracking
  - Time-based productivity analysis
  - Project comparison
  - Customizable time ranges

#### Technical Features
- **Clean Architecture Implementation**
  - Domain-driven design
  - Repository pattern
  - Use case separation
  - Dependency injection

- **Database Schema**
  - 11 migration versions
  - Comprehensive indexing
  - JSON metadata support
  - Foreign key constraints

- **Japanese Language Support**
  - TinySegmenter integration
  - Proper tokenization
  - Japanese UI throughout

### Infrastructure
- Electron framework for desktop application
- React with TypeScript for UI
- DuckDB for local database
- Tailwind CSS for styling
- Framer Motion for animations
- React Flow for graph visualizations

### Development Tools
- Comprehensive test setup
- ESLint configuration
- Development diary system
- Git workflow integration
- Mock data generators

### Security & Privacy
- Local-first architecture
- No cloud dependencies
- API key management
- Secure backup encryption ready

### Known Issues
- Some features use mock data pending full implementation
- API usage tracking requires actual API integration
- Character relationships need persistent storage implementation

### Contributors
- Human developer (project owner)
- Claude AI (development assistant)

---

## Future Roadmap

### Planned Features
- Mobile/tablet companion app
- Cloud sync integration
- Plugin system for extensions
- Advanced AI model fine-tuning
- Collaborative writing features
- Publishing platform integration
- Voice input/output support
- Multi-language support

### Technical Improvements
- Performance optimization for large projects
- Real-time collaboration infrastructure
- Advanced caching strategies
- Offline-first sync system

For more information, see the [README](README.md) and [documentation](docs/).