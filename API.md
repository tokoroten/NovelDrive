# NovelDrive API Documentation

## Overview

NovelDrive is an AI-powered novel writing assistant built with Electron. The application uses an IPC (Inter-Process Communication) based architecture where the main process handles data persistence and business logic, while the renderer process manages the UI.

## Architecture

### Data Flow
```
Renderer Process (Frontend)
    ↓ IPC invoke
Main Process (Backend)
    ↓
IPC Handlers → Services → Repositories → SQLite Database
```

### Layer Responsibilities
- **IPC Handlers**: Handle incoming requests from renderer, validate input, orchestrate services
- **Services**: Business logic, external API integration (OpenAI, vector search, etc.)
- **Repositories**: Data access layer with CRUD operations
- **Database**: SQLite for local data persistence

## Database Schema

### Core Tables

#### projects
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON
);
```
**Purpose**: Stores novel projects and their metadata

#### knowledge
```sql
CREATE TABLE knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'text', 'url', 'image', 'note', etc.
    title TEXT,
    content TEXT NOT NULL,
    embeddings TEXT, -- JSON array of floats
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```
**Purpose**: Stores knowledge items (text, images, URLs) with vector embeddings for semantic search

#### knowledge_links
```sql
CREATE TABLE knowledge_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    link_type TEXT NOT NULL, -- 'semantic', 'reference', 'temporal', etc.
    strength REAL DEFAULT 1.0,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES knowledge(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES knowledge(id) ON DELETE CASCADE
);
```
**Purpose**: Defines relationships between knowledge items for graph visualization

#### characters
```sql
CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    personality TEXT,
    appearance TEXT,
    background TEXT,
    relationships TEXT, -- JSON
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```
**Purpose**: Character profiles and development

#### plots
```sql
CREATE TABLE plots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    parent_plot_id INTEGER,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    structure TEXT, -- JSON (three-act, kishōtenketsu, etc.)
    summary TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_plot_id) REFERENCES plots(id) ON DELETE SET NULL
);
```
**Purpose**: Plot structures with versioning support

#### chapters
```sql
CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plot_id INTEGER,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    summary TEXT,
    word_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft', -- 'draft', 'writing', 'review', 'complete'
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL
);
```
**Purpose**: Individual chapters with content and metadata

#### agent_discussions
```sql
CREATE TABLE agent_discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plot_id INTEGER,
    chapter_id INTEGER,
    purpose TEXT, -- 'plot_development', 'character_review', etc.
    participants TEXT, -- JSON array of agent types
    status TEXT DEFAULT 'ongoing', -- 'ongoing', 'paused', 'completed'
    summary TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);
```
**Purpose**: AI agent discussion sessions

#### agent_messages
```sql
CREATE TABLE agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL,
    agent_type TEXT NOT NULL, -- 'writer', 'editor', 'proofreader', 'deputy_editor'
    message_content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'suggestion', 'critique'
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id) REFERENCES agent_discussions(id) ON DELETE CASCADE
);
```
**Purpose**: Individual messages in agent discussions

## API Endpoints (IPC Handlers)

### Project Management

#### `project:getAll`
Get all active projects
- **Parameters**: None
- **Returns**: `Array<Project>`
```javascript
const projects = await window.electronAPI.invoke('project:getAll');
```

#### `project:getById`
Get project by ID
- **Parameters**: 
  - `projectId` (number): Project ID
- **Returns**: `Project | null`
```javascript
const project = await window.electronAPI.invoke('project:getById', projectId);
```

#### `project:create`
Create new project
- **Parameters**:
  - `projectData` (object):
    - `name` (string, required): Project name
    - `description` (string): Project description
    - `metadata` (object): Additional metadata
- **Returns**: `Project`
```javascript
const project = await window.electronAPI.invoke('project:create', {
    name: 'My Novel',
    description: 'A fantasy adventure'
});
```

#### `project:update`
Update project
- **Parameters**:
  - `projectId` (number): Project ID
  - `updates` (object): Fields to update
- **Returns**: `Project`
```javascript
const updated = await window.electronAPI.invoke('project:update', projectId, {
    description: 'Updated description'
});
```

#### `project:delete`
Delete project
- **Parameters**:
  - `projectId` (number): Project ID
- **Returns**: `{success: boolean}`
```javascript
await window.electronAPI.invoke('project:delete', projectId);
```

#### `project:getContext`
Get comprehensive project context for AI agents
- **Parameters**:
  - `projectId` (number): Project ID
- **Returns**: Project context object containing:
  - `project`: Basic project information (id, name, description, wordCount, chapterCount)
  - `chapters`: Recent chapters with metadata
  - `characters`: All project characters
  - `plot`: Current plot information
  - `knowledge`: Recent knowledge items
```javascript
const context = await window.electronAPI.invoke('project:getContext', {
    projectId: 1
});
// Returns:
// {
//   project: { id, name, description, wordCount, chapterCount },
//   chapters: [ { id, number, title, wordCount, status }, ... ],
//   characters: [ { id, name, description, personality }, ... ],
//   plot: { id, title, summary, structure } | null,
//   knowledge: [ { id, type, title, content }, ... ]
// }
```

### Knowledge Management

#### `knowledge:create`
Create knowledge item
- **Parameters**:
  - `knowledgeData` (object):
    - `project_id` (number): Project ID
    - `type` (string): Type ('text', 'url', 'image', 'note')
    - `title` (string): Title
    - `content` (string): Content
    - `metadata` (object): Additional metadata
- **Returns**: `Knowledge`
```javascript
const knowledge = await window.electronAPI.invoke('knowledge:create', {
    project_id: 1,
    type: 'text',
    title: 'Character Idea',
    content: 'A mysterious wizard...'
});
```

#### `knowledge:listByProject`
List knowledge by project
- **Parameters**:
  - `projectId` (object): `{projectId: number}`
- **Returns**: `{success: boolean, data: Array<Knowledge>}`
```javascript
const result = await window.electronAPI.invoke('knowledge:listByProject', {
    projectId: 1
});
```

#### `knowledge:search`
Search knowledge
- **Parameters**:
  - `projectId` (number): Project ID
  - `query` (string): Search query
  - `options` (object): Search options
- **Returns**: `Array<Knowledge>`
```javascript
const results = await window.electronAPI.invoke('knowledge:search', 
    projectId, 'character development', {limit: 10});
```

### Anything Box (Knowledge Processing)

#### `anythingBox:register`
Register content in anything box
- **Parameters**:
  - `data` (object):
    - `type` (string): Content type
    - `content` (string): Content
    - `title` (string): Title
    - `projectId` (number): Project ID
    - `options` (object): Processing options
- **Returns**: `{success: boolean, data: Knowledge}`
```javascript
const result = await window.electronAPI.invoke('anythingBox:register', {
    type: 'text',
    content: 'Story idea about...',
    title: 'New Story Concept',
    projectId: 1
});
```

#### `anythingBox:abstract`
Abstract an idea
- **Parameters**:
  - `data` (object):
    - `content` (string): Content to abstract
    - `type` (string): Content type
    - `projectId` (number): Project ID
- **Returns**: `{success: boolean, data: {abstractions: Array}}`
```javascript
const result = await window.electronAPI.invoke('anythingBox:abstract', {
    content: 'A hero saves the day',
    type: 'text',
    projectId: 1
});
```

#### `anythingBox:concretize`
Concretize abstractions into new ideas
- **Parameters**:
  - `data` (object):
    - `abstractions` (Array): Abstraction data
    - `originalContent` (string): Original content
    - `projectId` (number): Project ID
- **Returns**: `{success: boolean, data: {ideas: Array}}`
```javascript
const result = await window.electronAPI.invoke('anythingBox:concretize', {
    abstractions: abstractionsArray,
    originalContent: 'Original text',
    projectId: 1
});
```

#### `anythingBox:getRecent`
Get recent entries
- **Parameters**:
  - `data` (object):
    - `projectId` (number): Project ID
    - `limit` (number): Maximum entries to return
- **Returns**: `{success: boolean, data: Array<Knowledge>}`
```javascript
const result = await window.electronAPI.invoke('anythingBox:getRecent', {
    projectId: 1,
    limit: 50
});
```

### OpenAI Integration

#### `openai:setApiKey`
Set OpenAI API key
- **Parameters**:
  - `data` (object):
    - `apiKey` (string): OpenAI API key
- **Returns**: `{success: boolean}`
```javascript
await window.electronAPI.invoke('openai:setApiKey', {
    apiKey: 'sk-...'
});
```

#### `openai:getConfig`
Get OpenAI configuration
- **Parameters**: None
- **Returns**: Configuration object
  - `isConfigured` (boolean): Whether OpenAI service is configured
  - `hasApiKey` (boolean): Whether an API key is saved (true if apiKey exists and is not empty)
  - `model` (string): Current model setting
  - `temperature` (number): Current temperature setting
```javascript
const config = await window.electronAPI.invoke('openai:getConfig');
// Returns: {
//   isConfigured: true,
//   hasApiKey: true,
//   model: 'gpt-4o',
//   temperature: 0.7
// }
```

#### `openai:generateText`
Generate text completion
- **Parameters**:
  - `data` (object):
    - `prompt` (string): Text prompt
    - `options` (object): Generation options
- **Returns**: `{text: string}`
```javascript
const result = await window.electronAPI.invoke('openai:generateText', {
    prompt: 'Write a story about...',
    options: {temperature: 0.7}
});
```

#### `openai:testConnection`
Test OpenAI API connection
- **Parameters**:
  - `data` (object):
    - `apiKey` (string): API key to test
    - `model` (string): Model to test
    - `temperature` (number): Temperature setting
- **Returns**: Test result object
```javascript
const result = await window.electronAPI.invoke('openai:testConnection', {
    apiKey: 'sk-...',
    model: 'gpt-4o',
    temperature: 0.7
});
```

### Agent System

#### `agent:create`
Create custom agent
- **Parameters**:
  - `agentData` (object): Agent configuration
- **Returns**: Created agent object
```javascript
const agent = await window.electronAPI.invoke('agent:create', {
    name: 'Custom Editor',
    personality: 'Helpful and constructive',
    specialization: 'dialogue'
});
```

### Settings Management

#### `settings:get`
Get application settings
- **Parameters**: None
- **Returns**: Settings object
```javascript
const settings = await window.electronAPI.invoke('settings:get');
```

#### `settings:update`
Update application settings
- **Parameters**:
  - `updates` (object): Settings to update
- **Returns**: Updated settings object
```javascript
const settings = await window.electronAPI.invoke('settings:update', {
    'ui.theme': 'dark',
    'editor.fontSize': 16
});
```

## Response Format

All API responses follow this format:

### Success Response
```javascript
{
    success: true,
    data: <response_data>
}
```

### Error Response
```javascript
{
    success: false,
    error: {
        message: "Error description",
        code: "ERROR_CODE",
        details: <additional_error_info>
    }
}
```

## Data Types

### Project
```typescript
interface Project {
    id: number;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    metadata?: object;
}
```

### Knowledge
```typescript
interface Knowledge {
    id: number;
    project_id: number;
    type: 'text' | 'url' | 'image' | 'note';
    title?: string;
    content: string;
    embeddings?: number[];
    metadata?: object;
    created_at: string;
    updated_at: string;
}
```

### Character
```typescript
interface Character {
    id: number;
    project_id: number;
    name: string;
    description?: string;
    personality?: string;
    appearance?: string;
    background?: string;
    relationships?: object;
    metadata?: object;
    created_at: string;
    updated_at: string;
}
```

## Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Requested resource not found
- `PERMISSION_DENIED`: Access denied
- `EXTERNAL_API_ERROR`: External API call failed
- `DATABASE_ERROR`: Database operation failed
- `INTERNAL_ERROR`: Unexpected internal error

## Vector Search

The knowledge system includes semantic search capabilities using embeddings:

### How it works
1. Content is automatically embedded when created
2. Search queries are embedded using the same model
3. Similarity search returns relevant knowledge items
4. Results are ranked by semantic similarity

### Embedding Model
- Uses `multilingual-e5-base` for multilingual support
- Embeddings are stored as JSON arrays in the database
- Supports both Japanese and English content

## Performance Considerations

- Database queries use indexes on frequently accessed columns
- Large text content is paginated
- Vector search is optimized for typical query sizes
- Caching is implemented for frequently accessed data

## Security

- All database operations use parameterized queries
- Input validation at the IPC handler level
- File system access is restricted to app data directory
- API keys are stored securely in the system keychain

## Vector Search API

### Vector Search Endpoints

#### `vector:search`
Semantic search across indexed content
- **Parameters**:
  - `projectId` (string): Project ID
  - `query` (string): Search query
  - `options` (object):
    - `limit` (number): Maximum results (default: 10)
    - `minSimilarity` (number): Minimum similarity threshold (default: 0.5)
    - `entityTypes` (string[]): Filter by entity types
    - `excludeIds` (string[]): Exclude specific document IDs
    - `searchMode` (string): 'exact' | 'similar' | 'serendipity'
- **Returns**: Array of search results with similarity scores

#### `vector:findSimilar`
Find documents similar to a specific entity
- **Parameters**:
  - `projectId` (string): Project ID
  - `entityType` (string): Entity type
  - `entityId` (string): Entity ID
  - `options` (object): Same as search options
- **Returns**: Array of similar documents

#### `vector:indexKnowledge`
Index or re-index a knowledge item
- **Parameters**:
  - `knowledgeId` (string): Knowledge item ID
- **Returns**: Success status

#### `vector:indexChapter`
Index or re-index a chapter
- **Parameters**:
  - `chapterId` (string): Chapter ID
- **Returns**: Success status

#### `vector:reindexProject`
Rebuild vector index for entire project
- **Parameters**:
  - `projectId` (string): Project ID
- **Returns**: Success status

#### `vector:calculateSimilarity`
Calculate similarity between two texts
- **Parameters**:
  - `text1` (string): First text
  - `text2` (string): Second text
- **Returns**: Similarity score (0-1)

## Chapter & Plot API

### Plot Endpoints

#### `plot:create`
Create a new plot
- **Parameters**:
  - `plotData` (object):
    - `projectId` (number): Project ID
    - `title` (string): Plot title
    - `summary` (string): Plot summary
    - `order` (number): Display order
- **Returns**: Created plot object

#### `plot:getById`
Get plot by ID
- **Parameters**:
  - `plotId` (string): Plot ID
- **Returns**: Plot object

#### `plot:getByProject`
Get all plots for a project
- **Parameters**:
  - `projectId` (string): Project ID
- **Returns**: Array of plot objects

#### `plot:update`
Update plot
- **Parameters**:
  - `plotId` (string): Plot ID
  - `updates` (object): Fields to update
- **Returns**: Updated plot object

#### `plot:delete`
Delete plot
- **Parameters**:
  - `plotId` (string): Plot ID
- **Returns**: Success boolean

### Chapter Endpoints

#### `chapter:create`
Create a new chapter
- **Parameters**:
  - `chapterData` (object):
    - `plotId` (string): Plot ID
    - `title` (string): Chapter title
    - `summary` (string): Chapter summary
    - `order` (number): Display order
    - `status` (string): 'draft' | 'writing' | 'reviewing' | 'completed'
- **Returns**: Created chapter object

#### `chapter:getById`
Get chapter by ID
- **Parameters**:
  - `chapterId` (string): Chapter ID
  - `includeContent` (boolean): Include chapter content
- **Returns**: Chapter object

#### `chapter:getByPlot`
Get all chapters for a plot
- **Parameters**:
  - `plotId` (string): Plot ID
  - `includeContent` (boolean): Include chapter content
- **Returns**: Array of chapter objects

#### `chapter:update`
Update chapter (including content)
- **Parameters**:
  - `chapterId` (string): Chapter ID
  - `updates` (object): Fields to update (including content)
- **Returns**: Updated chapter object

#### `chapter:delete`
Delete chapter
- **Parameters**:
  - `chapterId` (string): Chapter ID
- **Returns**: Success boolean

#### `chapter:createVersion`
Create a new version of chapter content
- **Parameters**:
  - `chapterId` (string): Chapter ID
  - `content` (string): Chapter content
- **Returns**: Created version object

#### `chapter:getVersions`
Get version history for a chapter
- **Parameters**:
  - `chapterId` (string): Chapter ID
- **Returns**: Array of version objects

### Scene Endpoints

#### `scene:create`
Create a new scene
- **Parameters**:
  - `sceneData` (object):
    - `chapterId` (string): Chapter ID
    - `title` (string): Scene title
    - `summary` (string): Scene summary
    - `order` (number): Display order
- **Returns**: Created scene object

#### `scene:getByChapter`
Get all scenes for a chapter
- **Parameters**:
  - `chapterId` (string): Chapter ID
- **Returns**: Array of scene objects

### Statistics Endpoints

#### `statistics:getWriting`
Get writing statistics for a project
- **Parameters**:
  - `projectId` (string): Project ID
- **Returns**: Statistics object:
  - `totalWords` (number): Total word count
  - `todayWords` (number): Words written today
  - `averageWordsPerDay` (number): Average words per day
  - `writingDays` (number): Number of days with writing activity
  - `lastWritingDate` (Date): Last writing date

## Agent Meeting API

### Agent Management

#### `agent:getAll`
Get all available agents
- **Returns**: Array of agent objects

#### `agent:getStates`
Get current states of all agents
- **Returns**: Object mapping agent IDs to their states

#### `agent:createCustom`
Create a custom agent
- **Parameters**:
  - `agentData` (object): Agent configuration
- **Returns**: Created agent object

#### `agent:update`
Update agent configuration
- **Parameters**:
  - `agentId` (string): Agent ID
  - `updates` (object): Fields to update
- **Returns**: Updated agent object

#### `agent:delete`
Delete custom agent
- **Parameters**:
  - `agentId` (string): Agent ID
- **Returns**: Success boolean

### Session Management

#### `agent:createSession`
Create an agent meeting session
- **Parameters**:
  - `projectId` (string): Project ID
  - `type` (string): Session type
  - `participants` (string[]): Agent IDs
- **Returns**: Created session object

#### `agent:endSession`
End an active session
- **Parameters**:
  - `sessionId` (string): Session ID
- **Returns**: Success status

#### `agent:sendMessage`
Send message in session
- **Parameters**:
  - `sessionId` (string): Session ID
  - `senderId` (string): Sender agent ID
  - `content` (string): Message content
  - `type` (string): Message type
- **Returns**: Success status

#### `agent:getSessionMessages`
Get all messages in a session
- **Parameters**:
  - `sessionId` (string): Session ID
- **Returns**: Array of message objects

#### `agent:getSessionsByProject`
Get all sessions for a project
- **Parameters**:
  - `projectId` (string): Project ID
- **Returns**: Array of session objects