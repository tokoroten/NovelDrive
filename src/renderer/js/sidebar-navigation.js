// Sidebar Navigation Component

class SidebarNavigation {
    constructor() {
        this.currentPage = this.getCurrentPageFromPath();
    }

    getCurrentPageFromPath() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        const pageName = filename.replace('.html', '');
        return pageName;
    }

    render() {
        const navItems = [
            { id: 'agent-meeting', icon: '🤝', label: 'エージェント会議室', href: './agent-meeting.html' },
            { id: 'projects', icon: '📁', label: 'プロジェクト', href: './projects.html' },
            { id: 'project-workspace', icon: '💼', label: 'ワークスペース', href: './project-workspace.html' },
            { id: 'writing-editor', icon: '✍️', label: '執筆エディタ', href: './writing-editor.html' },
            { id: 'anything-box', icon: '📥', label: 'なんでもボックス', href: './anything-box.html' },
            { id: 'serendipity', icon: '✨', label: 'セレンディピティ', href: './serendipity.html' },
            { id: 'knowledge-graph', icon: '🕸️', label: 'ナレッジグラフ', href: './knowledge-graph.html' },
            { id: 'settings', icon: '⚙️', label: '設定', href: './settings.html' }
        ];

        const sidebarHTML = `
            <nav class="sidebar">
                <div class="app-title">
                    <h1>NovelDrive</h1>
                </div>
                <div class="project-selector-wrapper" id="sidebar-project-selector">
                    <!-- Project selector will be injected here -->
                </div>
                <ul class="nav-menu">
                    ${navItems.map(item => `
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

        return sidebarHTML;
    }

    attachEventListeners() {
        // Navigation click handler
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                const href = e.currentTarget.getAttribute('href');
                
                // If we're navigating to workspace and have a current project, add it to the URL
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

    mount(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with id "${containerId}" not found`);
            return;
        }

        // Insert sidebar at the beginning of the container
        container.insertAdjacentHTML('afterbegin', this.render());
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize project selector if available
        if (window.initializeProjectSelector) {
            window.initializeProjectSelector();
        }
    }
}

// Export for use in other files
window.SidebarNavigation = SidebarNavigation;

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Only auto-mount if there's an app-container without a sidebar
        const appContainer = document.querySelector('.app-container');
        const existingSidebar = document.querySelector('.sidebar');
        
        if (appContainer && !existingSidebar) {
            const sidebar = new SidebarNavigation();
            sidebar.mount('app-container');
        }
    });
}