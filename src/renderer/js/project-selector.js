// Project Selector Module
// Manages the project dropdown in the sidebar

class ProjectSelector {
    constructor() {
        this.currentProjectId = null;
        this.projects = [];
        this.selector = null;
        this.callbacks = new Map();
    }

    // Initialize the project selector
    async init() {
        // Check if we're in Electron environment
        const api = window.api || window.MockAPI;
        if (!api) {
            console.error('API not available');
            return;
        }

        // Load saved project ID from localStorage
        const savedProjectId = localStorage.getItem('current-project-id');
        if (savedProjectId) {
            this.currentProjectId = parseInt(savedProjectId);
        }

        // Load projects
        await this.loadProjects();

        // Create selector element if it doesn't exist
        this.createSelectorElement();

        // Set up event listeners
        this.setupEventListeners();

        // Update selector value
        if (this.currentProjectId && this.selector) {
            this.selector.value = this.currentProjectId;
        }
    }

    // Create the selector element in the sidebar
    createSelectorElement() {
        // Check if we should show project selector on this page
        if (!this.shouldShowProjectSelector()) {
            return;
        }

        // Find the placeholder or nav menu
        const placeholder = document.getElementById('project-selector-placeholder');
        const navMenu = document.querySelector('.nav-menu');
        
        if (!placeholder && !navMenu) return;

        // Check if selector already exists
        if (document.querySelector('.project-selector-wrapper')) return;

        // Create selector wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'project-selector-wrapper';
        wrapper.innerHTML = `
            <label class="project-selector-label">現在のプロジェクト</label>
            <select class="project-selector" id="project-selector">
                <option value="">プロジェクトを選択...</option>
            </select>
        `;

        // Insert into placeholder if exists, otherwise before nav menu
        if (placeholder) {
            placeholder.appendChild(wrapper);
        } else if (navMenu) {
            navMenu.parentNode.insertBefore(wrapper, navMenu);
        }

        // Store reference to selector
        this.selector = document.getElementById('project-selector');

        // Populate projects
        this.updateSelectorOptions();
    }

    // Check if project selector should be shown on current page
    shouldShowProjectSelector() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        const currentPage = filename.replace('.html', '');
        
        // Pages where project selector should not be shown
        const hideOnPages = ['projects', 'settings', 'index'];
        
        return !hideOnPages.includes(currentPage);
    }

    // Load projects from the backend
    async loadProjects() {
        try {
            const api = window.api || window.MockAPI;
            const projects = await api.invoke('project:getAll');
            this.projects = projects || [];
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
        }
    }

    // Update selector options
    updateSelectorOptions() {
        if (!this.selector) return;

        // Clear existing options
        this.selector.innerHTML = '<option value="">プロジェクトを選択...</option>';

        // Add project options
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            if (project.id === this.currentProjectId) {
                option.selected = true;
            }
            this.selector.appendChild(option);
        });
    }

    // Set up event listeners
    setupEventListeners() {
        if (!this.selector) return;

        this.selector.addEventListener('change', async (e) => {
            const projectId = e.target.value ? parseInt(e.target.value) : null;
            await this.selectProject(projectId);
        });

        // Listen for project updates
        window.addEventListener('project-created', () => this.refresh());
        window.addEventListener('project-updated', () => this.refresh());
        window.addEventListener('project-deleted', () => this.refresh());
    }

    // Select a project
    async selectProject(projectId) {
        this.currentProjectId = projectId;

        // Save to localStorage
        if (projectId) {
            localStorage.setItem('current-project-id', projectId.toString());
        } else {
            localStorage.removeItem('current-project-id');
        }

        // Update selector if needed
        if (this.selector && this.selector.value !== (projectId || '').toString()) {
            this.selector.value = projectId || '';
        }

        // Notify callbacks
        this.callbacks.forEach(callback => {
            try {
                callback(projectId);
            } catch (error) {
                console.error('Error in project change callback:', error);
            }
        });

        // Dispatch global event
        window.dispatchEvent(new CustomEvent('project-changed', {
            detail: { projectId }
        }));
    }

    // Register a callback for project changes
    onChange(callback) {
        const id = Date.now() + Math.random();
        this.callbacks.set(id, callback);
        return () => this.callbacks.delete(id);
    }

    // Get current project ID
    getCurrentProjectId() {
        return this.currentProjectId;
    }

    // Get current project
    getCurrentProject() {
        if (!this.currentProjectId) return null;
        return this.projects.find(p => p.id === this.currentProjectId);
    }

    // Refresh projects list
    async refresh() {
        await this.loadProjects();
        this.updateSelectorOptions();
    }

    // Check if a project is selected
    hasProject() {
        return this.currentProjectId !== null;
    }

    // Show project required message
    showProjectRequired() {
        const api = window.api || window.MockAPI;
        if (api && api.showMessage) {
            api.showMessage('プロジェクトを選択してください', 'warning');
        } else {
            alert('プロジェクトを選択してください');
        }
    }
}

// Create global instance
window.projectSelector = new ProjectSelector();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.projectSelector.init();
    });
} else {
    window.projectSelector.init();
}