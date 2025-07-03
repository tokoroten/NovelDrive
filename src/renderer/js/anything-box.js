// Anything Box page JavaScript

let currentProjectId = null;
let currentEntries = [];
let currentFilter = 'all';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEventListeners();
    checkProjectSelection();
});

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Forms
    document.getElementById('text-form').addEventListener('submit', handleTextSubmit);
    document.getElementById('url-form').addEventListener('submit', handleURLSubmit);
    document.getElementById('image-form').addEventListener('submit', handleImageSubmit);
    
    // Image handling
    const dropZone = document.getElementById('drop-zone');
    const imageInput = document.getElementById('image-input');
    const selectImageBtn = document.getElementById('select-image-btn');
    
    selectImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageSelect);
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleImageFile(files[0]);
        }
    });
    
    // Project selector
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);
    
    // Search
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentFilter = e.target.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterEntries();
        });
    });
}

// Load projects for selector
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
function handleProjectChange() {
    const selector = document.getElementById('project-selector');
    currentProjectId = selector.value ? parseInt(selector.value) : null;
    
    if (currentProjectId) {
        loadEntries();
    } else {
        currentEntries = [];
        renderEntries();
    }
    
    checkProjectSelection();
}

// Check if project is selected
function checkProjectSelection() {
    const hasProject = currentProjectId !== null;
    document.querySelectorAll('form button[type="submit"]').forEach(btn => {
        btn.disabled = !hasProject;
    });
    
    if (!hasProject) {
        showInfo('プロジェクトを選択してください');
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });
}

// Handle text submission
async function handleTextSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('text-title').value;
    const content = document.getElementById('text-content').value;
    
    if (!content.trim()) return;
    
    try {
        showLoading();
        
        const response = await window.api.invoke('anythingBox:processText', currentProjectId, content, {
            title: title || undefined
        });
        
        if (response.success) {
            document.getElementById('text-form').reset();
            await loadEntries();
            showSuccess('テキストを処理しました');
            showInspirations(response.data);
        } else {
            showError(response.error.message || 'テキストの処理に失敗しました');
        }
    } catch (error) {
        console.error('Failed to process text:', error);
        showError('テキストの処理に失敗しました');
    } finally {
        hideLoading();
    }
}

// Handle URL submission
async function handleURLSubmit(e) {
    e.preventDefault();
    
    const url = document.getElementById('url-input').value;
    
    if (!url.trim()) return;
    
    try {
        showLoading();
        
        const response = await window.api.invoke('anythingBox:processURL', currentProjectId, url);
        
        if (response.success) {
            document.getElementById('url-form').reset();
            await loadEntries();
            showSuccess('URLを処理しました');
            showInspirations(response.data);
        } else {
            showError(response.error.message || 'URLの処理に失敗しました');
        }
    } catch (error) {
        console.error('Failed to process URL:', error);
        showError('URLの処理に失敗しました');
    } finally {
        hideLoading();
    }
}

// Handle image submission
async function handleImageSubmit(e) {
    e.preventDefault();
    
    const imagePath = document.getElementById('image-input').dataset.path;
    const title = document.getElementById('image-title').value;
    
    if (!imagePath) return;
    
    try {
        showLoading();
        
        const response = await window.api.invoke('anythingBox:processImage', currentProjectId, imagePath, {
            title: title || undefined
        });
        
        if (response.success) {
            document.getElementById('image-form').reset();
            resetImagePreview();
            await loadEntries();
            showSuccess('画像を処理しました');
            showInspirations(response.data);
        } else {
            showError(response.error.message || '画像の処理に失敗しました');
        }
    } catch (error) {
        console.error('Failed to process image:', error);
        showError('画像の処理に失敗しました');
    } finally {
        hideLoading();
    }
}

// Handle image selection
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
    }
}

// Handle image file
function handleImageFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const preview = document.getElementById('image-preview');
        const dropContent = document.querySelector('.drop-zone-content');
        
        preview.src = e.target.result;
        preview.style.display = 'block';
        dropContent.style.display = 'none';
        
        // Store file path (mock for now)
        document.getElementById('image-input').dataset.path = file.name;
        document.querySelector('#image-form button[type="submit"]').disabled = false;
    };
    
    reader.readAsDataURL(file);
}

// Reset image preview
function resetImagePreview() {
    const preview = document.getElementById('image-preview');
    const dropContent = document.querySelector('.drop-zone-content');
    
    preview.style.display = 'none';
    preview.src = '';
    dropContent.style.display = 'block';
    
    document.getElementById('image-input').value = '';
    document.getElementById('image-input').dataset.path = '';
    document.querySelector('#image-form button[type="submit"]').disabled = true;
}

// Load entries
async function loadEntries() {
    if (!currentProjectId) return;
    
    try {
        const response = await window.api.invoke('anythingBox:getRecent', currentProjectId, 50);
        
        if (response.success) {
            currentEntries = response.data;
            renderEntries();
        } else {
            showError('エントリーの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Failed to load entries:', error);
        showError('エントリーの読み込みに失敗しました');
    }
}

// Render entries
function renderEntries() {
    const container = document.getElementById('entries-container');
    const emptyState = document.getElementById('empty-state');
    
    const filteredEntries = filterEntriesByType(currentEntries);
    
    if (filteredEntries.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    
    container.innerHTML = filteredEntries.map(entry => createEntryCard(entry)).join('');
}

// Filter entries by type
function filterEntriesByType(entries) {
    if (currentFilter === 'all') return entries;
    return entries.filter(entry => entry.type === currentFilter);
}

// Create entry card HTML
function createEntryCard(entry) {
    const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};
    const inspirations = metadata.inspirations || [];
    
    return `
        <div class="entry-card" data-entry-id="${entry.id}">
            <div class="entry-header">
                <div>
                    <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
                    <span class="entry-type type-${entry.type}">
                        ${getTypeIcon(entry.type)} ${getTypeLabel(entry.type)}
                    </span>
                </div>
                <div class="entry-actions">
                    <button class="secondary-btn" onclick="viewEntry(${entry.id})">
                        詳細
                    </button>
                    <button class="secondary-btn" onclick="deleteEntry(${entry.id})">
                        削除
                    </button>
                </div>
            </div>
            
            <p class="entry-content">${escapeHtml(entry.content)}</p>
            
            ${inspirations.length > 0 ? `
                <div class="inspirations-preview">
                    <div class="inspirations-title">インスピレーション</div>
                    <div class="inspiration-tags">
                        ${inspirations.slice(0, 3).map(insp => `
                            <span class="inspiration-tag">${getInspirationTypeLabel(insp.type)}</span>
                        `).join('')}
                        ${inspirations.length > 3 ? `<span class="inspiration-tag">+${inspirations.length - 3}</span>` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="entry-meta">
                <span class="entry-date">${new Date(entry.created_at).toLocaleString('ja-JP')}</span>
            </div>
        </div>
    `;
}

// Show inspirations
function showInspirations(entry) {
    const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};
    const inspirations = metadata.inspirations || [];
    
    if (inspirations.length === 0) return;
    
    const modal = document.getElementById('inspiration-modal');
    const content = document.getElementById('inspiration-content');
    
    content.innerHTML = `
        <h4>${escapeHtml(entry.title)}</h4>
        <div class="inspiration-list">
            ${inspirations.map(insp => `
                <div class="inspiration-item">
                    <div class="inspiration-type">${getInspirationTypeLabel(insp.type)}</div>
                    <div class="inspiration-text">${escapeHtml(insp.content)}</div>
                    <div class="inspiration-confidence">確信度: ${Math.round(insp.confidence * 100)}%</div>
                </div>
            `).join('')}
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Hide inspiration modal
function hideInspirationModal() {
    document.getElementById('inspiration-modal').style.display = 'none';
}

// View entry details
async function viewEntry(entryId) {
    try {
        const response = await window.api.invoke('anythingBox:getById', entryId);
        
        if (response.success) {
            showInspirations(response.data);
        }
    } catch (error) {
        console.error('Failed to load entry:', error);
        showError('エントリーの読み込みに失敗しました');
    }
}

// Delete entry
async function deleteEntry(entryId) {
    if (!confirm('このエントリーを削除しますか？')) return;
    
    try {
        const response = await window.api.invoke('anythingBox:delete', entryId);
        
        if (response.success) {
            await loadEntries();
            showSuccess('エントリーを削除しました');
        } else {
            showError('削除に失敗しました');
        }
    } catch (error) {
        console.error('Failed to delete entry:', error);
        showError('削除に失敗しました');
    }
}

// Perform search
async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query || !currentProjectId) return;
    
    try {
        const response = await window.api.invoke('anythingBox:search', currentProjectId, query);
        
        if (response.success) {
            currentEntries = response.data;
            renderEntries();
        }
    } catch (error) {
        console.error('Search failed:', error);
        showError('検索に失敗しました');
    }
}

// Filter entries
function filterEntries() {
    renderEntries();
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

// Loading indicator
function showLoading() {
    // Implementation would add a loading overlay
}

function hideLoading() {
    // Implementation would remove loading overlay
}

// Notification functions
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
window.viewEntry = viewEntry;
window.deleteEntry = deleteEntry;
window.hideInspirationModal = hideInspirationModal;