// Main application store using Zustand

const createAppStore = (create) => create((set, get) => ({
    // Current view/page
    currentView: 'projects',
    
    // Project state
    currentProjectId: null,
    projects: [],
    
    // UI state
    sidebarCollapsed: false,
    loading: false,
    error: null,
    
    // User settings
    settings: {
        api: {
            openai: {
                hasApiKey: false,
                model: 'gpt-4o',
                temperature: 0.7
            }
        },
        ai: {
            writerModerateIgnorance: true,
            responseLength: 'medium',
            language: 'ja',
            serendipityDistance: 0.5,
            serendipityNoise: 0.2
        },
        editor: {
            fontSize: 16,
            lineHeight: 1.6,
            showLineNumbers: false,
            wordWrap: true,
            autoSave: true,
            autoSaveInterval: 30,
            backupCount: 10
        }
    },
    
    // Actions
    setView: (view) => set({ currentView: view }),
    
    setCurrentProject: (projectId) => {
        set({ currentProjectId: projectId });
        // Save to localStorage for persistence
        if (projectId) {
            localStorage.setItem('selectedProjectId', projectId);
        } else {
            localStorage.removeItem('selectedProjectId');
        }
    },
    
    setProjects: (projects) => set({ projects }),
    
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    
    setLoading: (loading) => set({ loading }),
    
    setError: (error) => set({ error }),
    
    updateSettings: (path, value) => {
        set((state) => {
            const newSettings = { ...state.settings };
            const keys = path.split('.');
            let current = newSettings;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return { settings: newSettings };
        });
    },
    
    // Initialize store from localStorage
    init: async () => {
        try {
            // Load saved project
            const savedProjectId = localStorage.getItem('selectedProjectId');
            if (savedProjectId) {
                set({ currentProjectId: savedProjectId });
            }
            
            // Load projects
            const api = window.api || window.mockAPI;
            if (api) {
                const response = await api.invoke('project:getAll');
                if (response.success) {
                    set({ projects: response.data });
                }
                
                // Load settings
                const settings = await api.invoke('settings:get');
                const openAIConfig = await api.invoke('openai:getConfig');
                
                set({
                    settings: {
                        ...settings,
                        api: {
                            openai: openAIConfig
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to initialize store:', error);
            set({ error: error.message });
        }
    }
}));

// Export for use in app
window.createAppStore = createAppStore;