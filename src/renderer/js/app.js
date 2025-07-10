// Main App Component for SPA

const { useState, useEffect, createElement: h } = React;
const { create } = window.zustand;

// Initialize store
const useStore = create(window.createAppStore);

// Page components will be loaded dynamically

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

// Page components map
const pageComponents = {
    'agent-meeting': AgentMeetingPage,
    'projects': ProjectsPage,
    'project-workspace': ProjectWorkspacePage,
    'writing-editor': WritingEditorPage,
    'anything-box': AnythingBoxPage,
    'serendipity': SerendipityPage,
    'knowledge-graph': KnowledgeGraphPage,
    'settings': SettingsPage
};

// Sidebar Component
function Sidebar() {
    const currentView = useStore(state => state.currentView);
    const setView = useStore(state => state.setView);
    const currentProjectId = useStore(state => state.currentProjectId);
    const projects = useStore(state => state.projects);
    const setCurrentProject = useStore(state => state.setCurrentProject);
    
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
    const currentView = useStore(state => state.currentView);
    const loading = useStore(state => state.loading);
    const error = useStore(state => state.error);
    const init = useStore(state => state.init);
    
    // Initialize app on mount
    useEffect(() => {
        init();
    }, []);
    
    // Get current page component
    const PageComponent = pageComponents[currentView] || pageComponents.projects;
    
    return h('div', { className: 'app-container' },
        h(Sidebar),
        h('main', { className: 'main-content' },
            error && h('div', { className: 'error-banner' }, error),
            loading ? 
                h('div', { className: 'loading-spinner' }, 'Loading...') :
                h(PageComponent)
        )
    );
}

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(h(App));