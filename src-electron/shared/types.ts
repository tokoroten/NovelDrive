// Shared types between main and renderer processes

export interface Project {
  id: number
  name: string
  description?: string
  created_at: string
  updated_at: string
  metadata?: string
}

export interface Knowledge {
  id: number
  project_id: number
  type: 'text' | 'url' | 'image' | 'note'
  title?: string
  content: string
  embeddings?: string
  metadata?: string
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: number
  project_id: number
  plot_id?: number
  chapter_number: number
  title?: string
  content?: string
  summary?: string
  word_count: number
  character_count: number
  status: 'draft' | 'writing' | 'review' | 'complete'
  metadata?: string
  created_at: string
  updated_at: string
}

export interface Character {
  id: number
  project_id: number
  name: string
  description?: string
  personality?: string
  appearance?: string
  background?: string
  relationships?: string
  metadata?: string
  created_at: string
  updated_at: string
}

export interface Plot {
  id: number
  project_id: number
  parent_plot_id?: number
  version: string
  title: string
  structure?: string
  summary?: string
  metadata?: string
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}