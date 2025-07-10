// Global Store with Zustand and persistence

// Simple Zustand implementation
const createStore = (createState) => {
    let state;
    const listeners = new Set();
    
    const setState = (partial, replace) => {
        const nextState = typeof partial === 'function' ? partial(state) : partial;
        
        if (!replace) {
            state = Object.assign({}, state, nextState);
        } else {
            state = nextState;
        }
        
        // Persist to localStorage
        persistState(state);
        
        // Notify all listeners
        listeners.forEach(listener => listener(state));
        
        // Broadcast to other windows via BroadcastChannel (only serializable data)
        if (window.globalStoreChannel) {
            // Extract only serializable state (no functions)
            const serializableState = {
                currentView: state.currentView,
                currentProjectId: state.currentProjectId,
                projects: state.projects,
                sidebarCollapsed: state.sidebarCollapsed,
                settings: state.settings
            };
            
            window.globalStoreChannel.postMessage({
                type: 'STATE_UPDATE',
                state: serializableState
            });
        }
    };
    
    const getState = () => state;
    
    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    
    const destroy = () => listeners.clear();
    
    const api = { setState, getState, subscribe, destroy };
    state = createState(setState, getState, api) || {};
    
    return api;
};

// Persist state to localStorage
const persistState = (state) => {
    try {
        // Only persist serializable data
        const serializableState = {};
        Object.keys(state).forEach(key => {
            if (typeof state[key] !== 'function') {
                serializableState[key] = state[key];
            }
        });
        
        localStorage.setItem('noveldrive-global-state', JSON.stringify(serializableState));
    } catch (error) {
        console.error('Failed to persist state:', error);
    }
};

// Load state from localStorage
const loadPersistedState = () => {
    try {
        const saved = localStorage.getItem('noveldrive-global-state');
        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        console.error('Failed to load persisted state:', error);
        return null;
    }
};

// Create the global store
const createGlobalStore = () => {
    const persistedState = loadPersistedState();
    
    return createStore((set, get) => ({
        // Initial state
        currentView: 'projects',
        currentProjectId: persistedState?.currentProjectId || null,
        projects: persistedState?.projects || [],
        sidebarCollapsed: persistedState?.sidebarCollapsed || false,
        settings: persistedState?.settings || {
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
                language: 'ja'
            },
            editor: {
                fontSize: 16,
                lineHeight: 1.6,
                showLineNumbers: false,
                wordWrap: true,
                autoSave: true,
                autoSaveInterval: 30
            }
        },
        
        // Actions
        setCurrentProject: (projectId) => {
            set({ currentProjectId: projectId });
            // Also save to sessionStorage for backward compatibility
            if (projectId) {
                sessionStorage.setItem('currentProjectId', projectId);
                localStorage.setItem('selectedProjectId', projectId);
            }
        },
        
        setProjects: (projects) => set({ projects }),
        
        updateProject: (projectId, updates) => {
            set(state => ({
                projects: state.projects.map(p => 
                    p.id === projectId ? { ...p, ...updates } : p
                )
            }));
        },
        
        addProject: (project) => {
            set(state => ({
                projects: [...state.projects, project]
            }));
        },
        
        deleteProject: (projectId) => {
            set(state => ({
                projects: state.projects.filter(p => p.id !== projectId),
                currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId
            }));
        },
        
        toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
        
        updateSettings: (path, value) => {
            set(state => {
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
        
        // Load initial data from backend
        loadFromBackend: async () => {
            try {
                const api = window.api || window.mockAPI;
                if (!api) return;
                
                // Load projects
                const projectsResponse = await api.invoke('project:getAll');
                if (projectsResponse.success) {
                    set({ projects: projectsResponse.data });
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
            } catch (error) {
                console.error('Failed to load from backend:', error);
            }
        },
        
        // Merge persisted state
        ...persistedState
    }));
};

// Initialize store and cross-window synchronization
let globalStore;
let broadcastChannel;

const initializeGlobalStore = () => {
    // Create store if not exists
    if (!globalStore) {
        globalStore = createGlobalStore();
        
        // Set up BroadcastChannel for cross-window sync
        try {
            broadcastChannel = new BroadcastChannel('noveldrive-store');
            window.globalStoreChannel = broadcastChannel;
            
            // Listen for updates from other windows
            broadcastChannel.onmessage = (event) => {
                if (event.data.type === 'STATE_UPDATE') {
                    // Merge only the serializable state
                    const currentState = globalStore.getState();
                    const updates = event.data.state;
                    
                    // Update state properties individually to preserve functions
                    Object.keys(updates).forEach(key => {
                        if (typeof updates[key] !== 'function') {
                            currentState[key] = updates[key];
                        }
                    });
                    
                    // Trigger UI updates
                    window.dispatchEvent(new CustomEvent('globalStateChanged', {
                        detail: currentState
                    }));
                }
            };
        } catch (error) {
            console.warn('BroadcastChannel not supported, falling back to localStorage events');
            
            // Fallback to storage events
            window.addEventListener('storage', (e) => {
                if (e.key === 'noveldrive-global-state' && e.newValue) {
                    try {
                        const newState = JSON.parse(e.newValue);
                        globalStore.setState(newState, true);
                        
                        window.dispatchEvent(new CustomEvent('globalStateChanged', {
                            detail: newState
                        }));
                    } catch (error) {
                        console.error('Failed to parse storage event:', error);
                    }
                }
            });
        }
        
        // Load data from backend on initialization
        globalStore.getState().loadFromBackend();
    }
    
    return globalStore;
};

// Hook-like interface for easy use
const useGlobalStore = (selector) => {
    const store = initializeGlobalStore();
    const state = store.getState();
    
    if (selector) {
        return selector(state);
    }
    
    return state;
};

// Subscribe to changes
const subscribeToStore = (listener) => {
    const store = initializeGlobalStore();
    return store.subscribe(listener);
};

// Get current state
const getGlobalState = () => {
    const store = initializeGlobalStore();
    return store.getState();
};

// Update state
const updateGlobalState = (updates) => {
    const store = initializeGlobalStore();
    store.setState(updates);
};

// Export for use
window.globalStore = {
    use: useGlobalStore,
    subscribe: subscribeToStore,
    getState: getGlobalState,
    setState: updateGlobalState,
    initialize: initializeGlobalStore
};

// Auto-initialize on load
initializeGlobalStore();