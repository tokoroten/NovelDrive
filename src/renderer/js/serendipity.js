// Serendipity Search page JavaScript

let currentProjectId = null;
let currentMode = 'search';
let searchResults = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchMode(e.currentTarget.dataset.mode));
    });

    // Search
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Discover
    document.getElementById('discover-btn').addEventListener('click', discoverInspirations);

    // Related
    document.getElementById('related-btn').addEventListener('click', findRelated);
    document.getElementById('base-item-selector').addEventListener('change', (e) => {
        document.getElementById('related-btn').disabled = !e.target.value;
    });

    // Project selector
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);

    // Sliders
    const noiseSlider = document.getElementById('noise-level');
    const diversitySlider = document.getElementById('diversity-weight');

    noiseSlider.addEventListener('input', (e) => {
        document.getElementById('noise-level-value').textContent = `${e.target.value}%`;
    });

    diversitySlider.addEventListener('input', (e) => {
        document.getElementById('diversity-weight-value').textContent = `${e.target.value}%`;
    });

    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Load projects
async function loadProjects() {
    try {
        const response = await window.api.invoke('project:getAll');
        
        if (response.success) {
            const selector = document.getElementById('project-selector');
            selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
            
            response.data.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                selector.appendChild(option);
            });
            
            // Select first project if available
            if (response.data.length > 0) {
                selector.value = response.data[0].id;
                handleProjectChange();
            }
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// Handle project change
async function handleProjectChange() {
    const selector = document.getElementById('project-selector');
    currentProjectId = selector.value ? parseInt(selector.value) : null;
    
    if (currentProjectId) {
        await loadKnowledgeItems();
        clearResults();
    }
}

// Load knowledge items for related search
async function loadKnowledgeItems() {
    if (!currentProjectId) return;

    try {
        const response = await window.api.invoke('anythingBox:getRecent', currentProjectId, 100);
        
        if (response.success) {
            const selector = document.getElementById('base-item-selector');
            selector.innerHTML = '<option value="">ナレッジを選択...</option>';
            
            response.data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.title;
                selector.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load knowledge items:', error);
    }
}

// Switch mode
function switchMode(mode) {
    currentMode = mode;
    
    // Update buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Show/hide sections
    document.getElementById('search-mode').style.display = mode === 'search' ? 'block' : 'none';
    document.getElementById('discover-mode').style.display = mode === 'discover' ? 'block' : 'none';
    document.getElementById('related-mode').style.display = mode === 'related' ? 'block' : 'none';
    
    clearResults();
}

// Perform search
async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query || !currentProjectId) {
        showInfo('検索キーワードとプロジェクトを選択してください');
        return;
    }
    
    const noiseLevel = document.getElementById('noise-level').value / 100;
    const diversityWeight = document.getElementById('diversity-weight').value / 100;
    
    showLoading();
    
    try {
        const response = await window.api.invoke('serendipity:search', currentProjectId, query, {
            noiseLevel,
            diversityWeight,
            limit: 20
        });
        
        if (response.success) {
            searchResults = response.data;
            renderResults();
        } else {
            showError('検索に失敗しました');
        }
    } catch (error) {
        console.error('Search failed:', error);
        showError('検索中にエラーが発生しました');
    } finally {
        hideLoading();
    }
}

// Discover inspirations
async function discoverInspirations() {
    if (!currentProjectId) {
        showInfo('プロジェクトを選択してください');
        return;
    }
    
    showLoading();
    
    try {
        const response = await window.api.invoke('serendipity:discover', currentProjectId, {
            limit: 15
        });
        
        if (response.success) {
            searchResults = response.data;
            renderResults();
        } else {
            showError('インスピレーション発見に失敗しました');
        }
    } catch (error) {
        console.error('Discover failed:', error);
        showError('インスピレーション発見中にエラーが発生しました');
    } finally {
        hideLoading();
    }
}

// Find related items
async function findRelated() {
    const itemId = document.getElementById('base-item-selector').value;
    
    if (!itemId) {
        showInfo('ナレッジを選択してください');
        return;
    }
    
    showLoading();
    
    try {
        const response = await window.api.invoke('serendipity:findRelated', parseInt(itemId), {
            limit: 20,
            noiseLevel: 0.1
        });
        
        if (response.success) {
            searchResults = response.data;
            renderResults();
        } else {
            showError('関連検索に失敗しました');
        }
    } catch (error) {
        console.error('Find related failed:', error);
        showError('関連検索中にエラーが発生しました');
    } finally {
        hideLoading();
    }
}

// Render results
function renderResults() {
    const container = document.getElementById('results-container');
    const emptyState = document.getElementById('empty-state');
    
    if (searchResults.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = searchResults.map((result, index) => createResultCard(result, index)).join('');
    
    // Add click handlers
    container.querySelectorAll('.result-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                viewDetail(card.dataset.itemId);
            }
        });
    });
}

// Create result card HTML
function createResultCard(result, index) {
    const metadata = result.metadata ? JSON.parse(result.metadata) : {};
    const similarity = result.similarity || 0;
    const distance = result.distance || 0;
    const score = result.score || 0;
    
    return `
        <div class="result-card" data-item-id="${result.id}" style="animation-delay: ${index * 0.1}s">
            <div class="result-header">
                <div>
                    <h3 class="result-title">${escapeHtml(result.title)}</h3>
                    <span class="result-type type-${result.type}">
                        ${getTypeIcon(result.type)} ${getTypeLabel(result.type)}
                    </span>
                </div>
                <div class="result-actions">
                    <button class="secondary-btn" onclick="viewDetail(${result.id})">
                        詳細
                    </button>
                    <button class="secondary-btn" onclick="findRelatedFrom(${result.id})">
                        関連
                    </button>
                </div>
            </div>
            
            <p class="result-content">${escapeHtml(result.content)}</p>
            
            <div class="result-metrics">
                <div class="metric">
                    <span class="metric-label">類似度</span>
                    <span class="metric-value">${Math.round(similarity * 100)}%</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${similarity * 100}%"></div>
                    </div>
                </div>
                <div class="metric">
                    <span class="metric-label">距離</span>
                    <span class="metric-value">${distance.toFixed(2)}</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${distance * 100}%"></div>
                    </div>
                </div>
                <div class="metric">
                    <span class="metric-label">スコア</span>
                    <span class="metric-value">${score.toFixed(2)}</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${score * 100}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="result-meta">
                <span class="result-date">${new Date(result.created_at).toLocaleString('ja-JP')}</span>
            </div>
        </div>
    `;
}

// View detail
async function viewDetail(itemId) {
    try {
        const response = await window.api.invoke('anythingBox:getById', parseInt(itemId));
        
        if (response.success) {
            showDetailModal(response.data);
        }
    } catch (error) {
        console.error('Failed to load detail:', error);
        showError('詳細の読み込みに失敗しました');
    }
}

// Show detail modal
function showDetailModal(item) {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');
    const metadata = item.metadata ? JSON.parse(item.metadata) : {};
    
    document.getElementById('detail-title').textContent = item.title;
    
    content.innerHTML = `
        <div class="detail-section">
            <h4>コンテンツ</h4>
            <div class="detail-text">${escapeHtml(item.content)}</div>
        </div>
        
        ${metadata.inspirations ? `
            <div class="detail-section">
                <h4>インスピレーション</h4>
                <div class="inspiration-list">
                    ${metadata.inspirations.map(insp => `
                        <div class="inspiration-item">
                            <div class="inspiration-type">${getInspirationTypeLabel(insp.type)}</div>
                            <div class="inspiration-text">${escapeHtml(insp.content)}</div>
                            <div class="inspiration-confidence">確信度: ${Math.round(insp.confidence * 100)}%</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="detail-section">
            <h4>メトリクス</h4>
            <div class="detail-metrics">
                <div class="metric">
                    <span class="metric-label">タイプ</span>
                    <span class="metric-value">${getTypeLabel(item.type)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">作成日</span>
                    <span class="metric-value">${new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
                ${item.embeddings ? `
                    <div class="metric">
                        <span class="metric-label">埋め込み</span>
                        <span class="metric-value">生成済み</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Hide detail modal
function hideDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// Find related from specific item
function findRelatedFrom(itemId) {
    // Switch to related mode
    switchMode('related');
    
    // Select the item
    document.getElementById('base-item-selector').value = itemId;
    document.getElementById('related-btn').disabled = false;
    
    // Perform search
    findRelated();
}

// Clear results
function clearResults() {
    searchResults = [];
    document.getElementById('results-container').innerHTML = '';
    document.getElementById('empty-state').style.display = 'flex';
}

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    switch (page) {
        case 'projects':
            window.location.href = './projects.html';
            break;
        case 'anything-box':
            window.location.href = './anything-box.html';
            break;
        case 'serendipity':
            // Already on this page
            break;
        default:
            showInfo(`${e.currentTarget.querySelector('span:last-child').textContent}は開発中です`);
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTypeIcon(type) {
    const icons = {
        text: '📝',
        url: '🌐',
        image: '🖼️'
    };
    return icons[type] || '📄';
}

function getTypeLabel(type) {
    const labels = {
        text: 'テキスト',
        url: 'URL',
        image: '画像'
    };
    return labels[type] || type;
}

function getInspirationTypeLabel(type) {
    const labels = {
        character: 'キャラクター',
        scene: 'シーン',
        theme: 'テーマ',
        plot: 'プロット',
        worldbuilding: '世界観'
    };
    return labels[type] || type;
}

// Loading/Notification functions
function showLoading() {
    const container = document.getElementById('results-container');
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">⚡</div>
            <p>探索中...</p>
        </div>
    `;
    document.getElementById('empty-state').style.display = 'none';
}

function hideLoading() {
    // Loading is replaced by results or empty state
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showInfo(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    const colors = {
        error: '#f44336',
        success: '#4CAF50',
        info: '#2196F3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.style.color = 'white';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Make functions available globally
window.viewDetail = viewDetail;
window.findRelatedFrom = findRelatedFrom;
window.hideDetailModal = hideDetailModal;