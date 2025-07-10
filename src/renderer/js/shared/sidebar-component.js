// Shared Sidebar Component for all pages

class SharedSidebar {
    constructor() {
        this.currentPage = this.getCurrentPageFromPath();
        this.navItems = [
            { id: 'agent-meeting', icon: '🤝', label: 'エージェント会議室', href: './agent-meeting.html' },
            { id: 'projects', icon: '📁', label: 'プロジェクト', href: './projects.html' },
            { id: 'project-workspace', icon: '💼', label: 'ワークスペース', href: './project-workspace.html' },
            { id: 'writing-editor', icon: '✍️', label: '執筆エディタ', href: './writing-editor.html' },
            { id: 'anything-box', icon: '📥', label: 'なんでもボックス', href: './anything-box.html' },
            { id: 'serendipity', icon: '✨', label: 'セレンディピティ', href: './serendipity.html' },
            { id: 'knowledge-graph', icon: '🕸️', label: 'ナレッジグラフ', href: './knowledge-graph.html' },
            { id: 'settings', icon: '⚙️', label: '設定', href: './settings.html' }
        ];
    }

    getCurrentPageFromPath() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        const pageName = filename.replace('.html', '');
        return pageName;
    }

    getProjectsFromStore() {
        const state = window.globalStore.getState();
        return state.projects || [];
    }
    
    getCurrentProjectFromStore() {
        const state = window.globalStore.getState();
        return state.currentProjectId;
    }

    createProjectSelector(projects, currentProjectId) {
        return `
            <div class="project-selector-wrapper">
                <select id="global-project-selector" class="project-selector">
                    <option value="">プロジェクトを選択...</option>
                    ${projects.map(project => `
                        <option value="${project.id}" ${project.id == currentProjectId ? 'selected' : ''}>
                            ${project.name}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    render(projects = [], currentProjectId = null) {
        return `
            <nav class="sidebar">
                <div class="app-title">
                    <h1>NovelDrive</h1>
                </div>
                ${this.createProjectSelector(projects, currentProjectId)}
                <ul class="nav-menu">
                    ${this.navItems.map(item => `
                        <li class="nav-item ${this.currentPage === item.id ? 'active' : ''}">
                            <a href="${item.href}" data-page="${item.id}">
                                <span class="icon">${item.icon}</span>
                                <span>${item.label}</span>
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </nav>
        `;
    }

    attachEventListeners() {
        // Project selector change
        const selector = document.getElementById('global-project-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                const projectId = e.target.value;
                
                // Update global store
                const state = window.globalStore.getState();
                state.setCurrentProject(projectId);
                
                // Trigger project change event
                window.dispatchEvent(new CustomEvent('projectChanged', { 
                    detail: { projectId } 
                }));
                
                // Update workspace link if needed
                if (this.currentPage === 'projects' && projectId) {
                    const workspaceLink = document.querySelector('[data-page="project-workspace"]');
                    if (workspaceLink) {
                        workspaceLink.href = `./project-workspace.html?projectId=${projectId}`;
                    }
                }
            });
        }

        // Navigation click handlers
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                const href = e.currentTarget.getAttribute('href');
                
                // If navigating to workspace and have a current project, add it to the URL
                if (page === 'project-workspace') {
                    const currentProjectId = sessionStorage.getItem('currentProjectId') || 
                                           localStorage.getItem('selectedProjectId');
                    if (currentProjectId) {
                        e.preventDefault();
                        window.location.href = `${href}?projectId=${currentProjectId}`;
                        return;
                    }
                }
            });
        });
    }

    initialize(containerId = 'app-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with id "${containerId}" not found`);
            return;
        }

        // Get data from global store
        const projects = this.getProjectsFromStore();
        const currentProjectId = this.getCurrentProjectFromStore();

        // Render sidebar
        this.renderSidebar(container, projects, currentProjectId);
        
        // Subscribe to store changes
        window.globalStore.subscribe((state) => {
            // Re-render when projects or current project changes
            this.renderSidebar(container, state.projects, state.currentProjectId);
        });

        // Listen for global state changes from other windows
        window.addEventListener('globalStateChanged', (event) => {
            const state = event.detail;
            this.renderSidebar(container, state.projects, state.currentProjectId);
        });

        // Handle URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get('projectId');
        if (projectIdFromUrl && projectIdFromUrl !== currentProjectId) {
            const state = window.globalStore.getState();
            state.setCurrentProject(projectIdFromUrl);
        }
    }
    
    renderSidebar(container, projects, currentProjectId) {
        const existingSidebar = container.querySelector('.sidebar');
        
        if (existingSidebar) {
            existingSidebar.outerHTML = this.render(projects, currentProjectId);
        } else {
            container.insertAdjacentHTML('afterbegin', this.render(projects, currentProjectId));
        }
        
        this.attachEventListeners();
    }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = new SharedSidebar();
    sidebar.initialize();
});

// Export for manual initialization
window.SharedSidebar = SharedSidebar;