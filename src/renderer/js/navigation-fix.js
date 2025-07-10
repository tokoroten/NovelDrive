// Navigation Fix Script - 全HTMLファイルのナビゲーションを統一

const navigationHTML = `
<ul class="nav-menu">
    <li class="nav-item">
        <a href="./agent-meeting.html" data-page="agent-meeting">
            <span class="icon">🤝</span>
            <span>エージェント会議室</span>
        </a>
    </li>
    <li class="nav-item">
        <a href="./projects.html" data-page="projects">
            <span class="icon">📁</span>
            <span>プロジェクト</span>
        </a>
    </li>
    <li class="nav-item">
        <a href="./writing-editor.html" data-page="writing-editor">
            <span class="icon">✍️</span>
            <span>執筆エディタ</span>
        </a>
    </li>
    <li class="nav-item">
        <a href="./anything-box.html" data-page="anything-box">
            <span class="icon">📥</span>
            <span>なんでもボックス</span>
        </a>
    </li>
    <li class="nav-item">
        <a href="./serendipity.html" data-page="serendipity">
            <span class="icon">✨</span>
            <span>セレンディピティ</span>
        </a>
    </li>
    <li class="nav-item">
        <a href="./knowledge-graph.html" data-page="knowledge-graph">
            <span class="icon">🕸️</span>
            <span>ナレッジグラフ</span>
        </a>
    </li>
    <li class="nav-item">
        <a href="./settings.html" data-page="settings">
            <span class="icon">⚙️</span>
            <span>設定</span>
        </a>
    </li>
</ul>
`;

// 現在のページに基づいてactiveクラスを設定
function setActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const link = item.querySelector('a');
        const page = link.dataset.page;
        
        // 現在のページと一致する場合activeクラスを追加
        if (page === currentPage || 
            (currentPage === 'index' && page === 'projects') ||
            (currentPage === '' && page === 'projects')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// DOMContentLoadedで実行
document.addEventListener('DOMContentLoaded', () => {
    setActiveNavigation();
});

// エクスポート
window.navigationFix = {
    navigationHTML,
    setActiveNavigation
};