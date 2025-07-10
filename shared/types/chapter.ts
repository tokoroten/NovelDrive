// Chapter-related type definitions

export interface Chapter {
  id: string
  plotId: string
  title: string
  content?: string
  summary?: string
  order: number
  wordCount: number
  status: 'draft' | 'writing' | 'reviewing' | 'completed'
  createdAt: Date
  updatedAt: Date
}

export interface Plot {
  id: string
  projectId: number
  title: string
  summary?: string
  order: number
  chapters?: Chapter[]
  createdAt: Date
  updatedAt: Date
}

export interface Scene {
  id: string
  chapterId: string
  title: string
  summary?: string
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface ChapterVersion {
  id: string
  chapterId: string
  content: string
  wordCount: number
  versionNumber: number
  createdAt: Date
}

export interface WritingStatistics {
  projectId: number
  totalWords: number
  todayWords: number
  averageWordsPerDay: number
  writingDays: number
  lastWritingDate?: Date
}

export interface EditorState {
  currentChapterId?: string
  cursorPosition: {
    line: number
    column: number
  }
  scrollPosition: number
  isAutoSaveEnabled: boolean
  lastSavedAt?: Date
}