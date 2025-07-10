// Main App Component for SPA (Non-module version)

(function() {
    const { useState, useEffect, createElement: h } = React;

    // Navigation items
    const navItems = [
        { id: 'agent-meeting', icon: '🤝', label: 'エージェント会議室' },
        { id: 'projects', icon: '📁', label: 'プロジェクト' },
        { id: 'project-workspace', icon: '💼', label: 'ワークスペース' },
        { id: 'writing-editor', icon: '✍️', label: '執筆エディタ' },
        { id: 'anything-box', icon: '📥', label: 'なんでもボックス' },
        { id: 'serendipity', icon: '✨', label: 'セレンディピティ' },
        { id: 'knowledge-graph', icon: '🕸️', label: 'ナレッジグラフ' },
        { id: 'settings', icon: '⚙️', label: '設定' }
    ];

    // Sidebar Component
    function Sidebar() {
        const currentView = window.useStore(state => state.currentView);
        const setView = window.useStore(state => state.setView);
        const currentProjectId = window.useStore(state => state.currentProjectId);
        const projects = window.useStore(state => state.projects);
        const setCurrentProject = window.useStore(state => state.setCurrentProject);
        
        return h('nav', { className: 'sidebar' },
            h('div', { className: 'app-title' },
                h('h1', null, 'NovelDrive')
            ),
            
            // Project selector
            h('div', { className: 'project-selector-wrapper' },
                h('select', {
                    className: 'project-selector',
                    value: currentProjectId || '',
                    onChange: (e) => setCurrentProject(e.target.value)
                },
                    h('option', { value: '' }, 'プロジェクトを選択...'),
                    projects.map(project =>
                        h('option', { key: project.id, value: project.id }, project.name)
                    )
                )
            ),
            
            // Navigation menu
            h('ul', { className: 'nav-menu' },
                navItems.map(item =>
                    h('li', {
                        key: item.id,
                        className: `nav-item ${currentView === item.id ? 'active' : ''}`
                    },
                        h('a', {
                            href: '#',
                            'data-page': item.id,
                            onClick: (e) => {
                                e.preventDefault();
                                setView(item.id);
                            }
                        },
                            h('span', { className: 'icon' }, item.icon),
                            h('span', null, item.label)
                        )
                    )
                )
            )
        );
    }

    // Main App Component
    function App() {
        const currentView = window.useStore(state => state.currentView);
        const loading = window.useStore(state => state.loading);
        const error = window.useStore(state => state.error);
        const init = window.useStore(state => state.init);
        
        // Initialize app on mount
        useEffect(() => {
            init();
        }, []);
        
        // Get current page component
        const PageComponent = window.pageComponents?.[currentView] || window.ProjectsPage;
        
        return h('div', { className: 'app-container' },
            h(Sidebar),
            h('main', { className: 'main-content' },
                error && h('div', { className: 'error-banner' }, error),
                loading ? 
                    h('div', { className: 'loading-spinner' }, 'Loading...') :
                    PageComponent ? h(PageComponent) : h('div', null, 'Page not found')
            )
        );
    }

    // Export App component
    window.App = App;
})();