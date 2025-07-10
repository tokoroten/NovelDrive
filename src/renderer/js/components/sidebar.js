// Sidebar Component
// 共通のサイドバーコンポーネント

class Sidebar {
    constructor() {
        this.currentPage = this.getCurrentPageFromPath();
    }

    // 現在のページを取得
    getCurrentPageFromPath() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        return filename.replace('.html', '');
    }

    // サイドバーHTMLを生成
    generateHTML() {
        return `
        <nav class="sidebar">
            <div class="app-title">
                <h1>NovelDrive</h1>
            </div>
            
            <!-- プロジェクトセレクターのプレースホルダー -->
            <div id="project-selector-placeholder"></div>
            
            <ul class="nav-menu">
                ${this.generateMenuItems()}
            </ul>
        </nav>
        `;
    }

    // メニューアイテムを生成
    generateMenuItems() {
        const menuItems = [
            { 
                page: 'projects', 
                icon: '📁', 
                label: 'プロジェクト',
                href: './projects.html',
                hideProjectSelector: true
            },
            { 
                page: 'project-workspace', 
                icon: '💼', 
                label: 'ワークスペース',
                href: './project-workspace.html',
                requiresProject: true
            },
            { 
                page: 'writing-editor', 
                icon: '✍️', 
                label: '執筆エディタ',
                href: './writing-editor.html',
                requiresProject: true
            },
            { 
                page: 'agent-meeting', 
                icon: '🤝', 
                label: 'エージェント会議室',
                href: './agent-meeting.html',
                requiresProject: true
            },
            { 
                page: 'anything-box', 
                icon: '📥', 
                label: 'なんでもボックス',
                href: './anything-box.html'
            },
            { 
                page: 'serendipity', 
                icon: '✨', 
                label: 'セレンディピティ',
                href: './serendipity.html'
            },
            { 
                page: 'knowledge-graph', 
                icon: '🕸️', 
                label: 'ナレッジグラフ',
                href: './knowledge-graph.html',
                requiresProject: true
            },
            { 
                page: 'plot-management', 
                icon: '📋', 
                label: 'プロット管理',
                href: './plot-management.html',
                requiresProject: true
            },
            { 
                page: 'project-knowledge', 
                icon: '📚', 
                label: 'プロジェクト知識',
                href: './project-knowledge.html',
                requiresProject: true
            },
            { 
                page: 'idea-gacha', 
                icon: '🎲', 
                label: 'アイデアガチャ',
                href: './idea-gacha.html'
            },
            { 
                page: 'analytics', 
                icon: '📊', 
                label: 'アナリティクス',
                href: './analytics.html',
                requiresProject: true
            },
            { 
                page: 'settings', 
                icon: '⚙️', 
                label: '設定',
                href: './settings.html'
            }
        ];

        return menuItems.map(item => {
            const isActive = this.currentPage === item.page ? 'active' : '';
            const requiresProjectClass = item.requiresProject ? 'requires-project' : '';
            
            return `
                <li class="nav-item ${isActive} ${requiresProjectClass}" data-page="${item.page}">
                    <a href="${item.href}" data-page="${item.page}">
                        <span class="icon">${item.icon}</span>
                        <span>${item.label}</span>
                    </a>
                </li>
            `;
        }).join('');
    }

    // サイドバーを初期化
    init() {
        // 既存のサイドバーを検索
        const existingSidebar = document.querySelector('.sidebar');
        
        if (existingSidebar) {
            // 既存のサイドバーがある場合は、その親要素に新しいサイドバーを挿入
            const parent = existingSidebar.parentElement;
            existingSidebar.remove();
            parent.insertAdjacentHTML('afterbegin', this.generateHTML());
        } else {
            // サイドバーがない場合は、app-containerの最初に挿入
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.insertAdjacentHTML('afterbegin', this.generateHTML());
            }
        }

        // プロジェクトセレクターの初期化を待つ
        this.initProjectSelector();
        
        // プロジェクトが必要なメニュー項目の制御
        this.updateMenuItemsVisibility();
    }

    // プロジェクトセレクターの初期化
    async initProjectSelector() {
        // project-selector.jsがロードされるのを待つ
        if (window.projectSelector) {
            await window.projectSelector.init();
            
            // プロジェクト変更時のイベントリスナー
            window.projectSelector.onChange((projectId) => {
                this.updateMenuItemsVisibility();
            });
        }
    }

    // メニュー項目の表示/非表示を更新
    updateMenuItemsVisibility() {
        const hasProject = window.projectSelector && window.projectSelector.hasProject();
        const requiresProjectItems = document.querySelectorAll('.nav-item.requires-project');
        
        requiresProjectItems.forEach(item => {
            if (hasProject) {
                item.style.display = '';
                item.style.opacity = '1';
            } else {
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';
            }
        });
    }

    // 現在のページでプロジェクトセレクターを表示するか判定
    shouldShowProjectSelector() {
        const hideOnPages = ['projects', 'settings'];
        return !hideOnPages.includes(this.currentPage);
    }
}

// グローバルインスタンスの作成と初期化
window.sidebar = new Sidebar();

// DOMContentLoaded時に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidebar.init();
    });
} else {
    window.sidebar.init();
}