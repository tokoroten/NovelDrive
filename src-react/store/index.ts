import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

export interface Settings {
  api: {
    openai: {
      hasApiKey: boolean
      model: string
      temperature: number
    }
  }
  ai: {
    writerModerateIgnorance: boolean
    responseLength: 'short' | 'medium' | 'long'
    language: string
  }
  editor: {
    fontSize: number
    lineHeight: number
    showLineNumbers: boolean
    wordWrap: boolean
    autoSave: boolean
    autoSaveInterval: number
  }
}

interface AppState {
  // State
  currentProjectId: string | null
  projects: Project[]
  sidebarCollapsed: boolean
  settings: Settings
  
  // Actions
  setCurrentProject: (projectId: string | null) => void
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void
  deleteProject: (projectId: string) => void
  toggleSidebar: () => void
  updateSettings: (path: string, value: any) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentProjectId: null,
      projects: [],
      sidebarCollapsed: false,
      settings: {
        api: {
          openai: {
            hasApiKey: false,
            model: 'gpt-4o',
            temperature: 0.7,
          },
        },
        ai: {
          writerModerateIgnorance: true,
          responseLength: 'medium',
          language: 'ja',
        },
        editor: {
          fontSize: 16,
          lineHeight: 1.6,
          showLineNumbers: false,
          wordWrap: true,
          autoSave: true,
          autoSaveInterval: 30,
        },
      },
      
      // Actions
      setCurrentProject: (projectId) =>
        set({ currentProjectId: projectId }),
      
      setProjects: (projects) => set({ projects }),
      
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),
      
      updateProject: (projectId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        })),
      
      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProjectId:
            state.currentProjectId === projectId ? null : state.currentProjectId,
        })),
      
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      updateSettings: (path, value) =>
        set((state) => {
          const newSettings = { ...state.settings }
          const keys = path.split('.')
          let current: any = newSettings
          
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {}
            current = current[keys[i]]
          }
          
          current[keys[keys.length - 1]] = value
          return { settings: newSettings }
        }),
    }),
    {
      name: 'noveldrive-storage',
    }
  )
)