// Project Knowledge functionality

// Global state
let currentProject = null;
let knowledgeItems = [];
let filteredItems = [];
let currentFilter = 'all';
let currentKnowledge = null;
let selectedTags = new Set();
let selectedImportance = new Set();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadProjects();
});

// Initialize event listeners
function initializeEventListeners() {
    // Project selector
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);
    
    // Add knowledge button
    document.getElementById('add-knowledge').addEventListener('click', openAddKnowledgeModal);
    
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', handleCategoryChange);
    });
    
    // Search
    document.getElementById('knowledge-search').addEventListener('input', handleSearch);
    
    // Filters
    document.getElementById('toggle-filters').addEventListener('click', toggleFilters);
    document.getElementById('sort-options').addEventListener('click', showSortOptions);
    
    // Modal category change
    document.getElementById('knowledge-category').addEventListener('change', handleModalCategoryChange);
    
    // Importance filters
    document.querySelectorAll('.importance-filters input').forEach(checkbox => {
        checkbox.addEventListener('change', handleImportanceFilter);
    });
}

// Load projects
async function loadProjects() {
    try {
        const projects = await window.api.invoke('project:list');
        const selector = document.getElementById('project-selector');
        
        selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
        
        // Check for saved current project
        const savedProjectId = localStorage.getItem('currentProjectId');
        if (savedProjectId) {
            selector.value = savedProjectId;
            await handleProjectChange({ target: selector });
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        window.api.showMessage('プロジェクトの読み込みに失敗しました', 'error');
    }
}

// Handle project change
async function handleProjectChange(event) {
    const projectId = event.target.value;
    if (!projectId) {
        currentProject = null;
        document.getElementById('add-knowledge').disabled = true;
        displayKnowledge([]);
        return;
    }
    
    currentProject = projectId;
    localStorage.setItem('currentProjectId', projectId);
    document.getElementById('add-knowledge').disabled = false;
    
    await loadKnowledge();
}

// Load knowledge for current project
async function loadKnowledge() {
    try {
        knowledgeItems = await window.api.invoke('knowledge:listByProject', { 
            projectId: currentProject 
        });
        
        // Update counts
        updateCategoryCounts();
        
        // Apply current filter
        filterKnowledge();
        
        // Load tags for filter
        loadTagFilters();
        
    } catch (error) {
        console.error('Failed to load knowledge:', error);
        window.api.showMessage('知識の読み込みに失敗しました', 'error');
    }
}

// Update category counts
function updateCategoryCounts() {
    const counts = {
        all: knowledgeItems.length,
        world: 0,
        character: 0,
        location: 0,
        item: 0,
        event: 0,
        other: 0
    };
    
    knowledgeItems.forEach(item => {
        const category = item.category || 'other';
        counts[category]++;
    });
    
    Object.keys(counts).forEach(category => {
        const element = document.getElementById(`count-${category}`);
        if (element) {
            element.textContent = counts[category];
        }
    });
}

// Handle category change
function handleCategoryChange(event) {
    const tab = event.currentTarget;
    const category = tab.dataset.category;
    
    // Update active state
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    currentFilter = category;
    filterKnowledge();
}

// Filter knowledge items
function filterKnowledge() {
    filteredItems = knowledgeItems.filter(item => {
        // Category filter
        if (currentFilter !== 'all' && item.category !== currentFilter) {
            return false;
        }
        
        // Tag filter
        if (selectedTags.size > 0) {
            const itemTags = item.tags || [];
            const hasSelectedTag = Array.from(selectedTags).some(tag => 
                itemTags.includes(tag)
            );
            if (!hasSelectedTag) return false;
        }
        
        // Importance filter
        if (selectedImportance.size > 0 && !selectedImportance.has(item.importance)) {
            return false;
        }
        
        return true;
    });
    
    displayKnowledge(filteredItems);
}

// Display knowledge items
function displayKnowledge(items) {
    const grid = document.getElementById('knowledge-grid');
    
    if (items.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>該当する知識がありません</p></div>';
        return;
    }
    
    grid.innerHTML = items.map(item => `
        <div class="knowledge-card" data-category="${item.category}" onclick="showKnowledgeDetail(${item.id})">
            <div class="knowledge-header">
                <div>
                    <div class="knowledge-title">${escapeHtml(item.title)}</div>
                    <div class="knowledge-category">${getCategoryLabel(item.category)}</div>
                </div>
                <div class="knowledge-importance" data-importance="${item.importance}">
                    ${getImportanceLabel(item.importance)}
                </div>
            </div>
            <div class="knowledge-content">${escapeHtml(item.content)}</div>
            <div class="knowledge-footer">
                <div class="knowledge-tags">
                    ${(item.tags || []).slice(0, 3).map(tag => 
                        `<span class="knowledge-tag">${escapeHtml(tag)}</span>`
                    ).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// Show knowledge detail
window.showKnowledgeDetail = async function(knowledgeId) {
    try {
        const knowledge = await window.api.invoke('knowledge:get', { id: knowledgeId });
        currentKnowledge = knowledge;
        
        // Fill detail modal
        document.getElementById('detail-title').textContent = knowledge.title;
        document.querySelector('.detail-category').textContent = getCategoryLabel(knowledge.category);
        document.querySelector('.detail-importance').textContent = getImportanceLabel(knowledge.importance);
        document.querySelector('.detail-date').textContent = new Date(knowledge.createdAt).toLocaleDateString('ja-JP');
        document.getElementById('detail-content').textContent = knowledge.content;
        
        // Category-specific details
        displayCategoryDetails(knowledge);
        
        // Tags
        displayDetailTags(knowledge.tags || []);
        
        // Relations
        await displayRelations(knowledge.id);
        
        // References
        await displayReferences(knowledge.id);
        
        document.getElementById('knowledge-detail-modal').style.display = 'flex';
    } catch (error) {
        console.error('Failed to load knowledge detail:', error);
        window.api.showMessage('詳細の読み込みに失敗しました', 'error');
    }
};

// Display category-specific details
function displayCategoryDetails(knowledge) {
    const container = document.getElementById('detail-extra');
    container.innerHTML = '';
    
    if (knowledge.category === 'character' && knowledge.metadata) {
        container.innerHTML = `
            <h5>キャラクター情報</h5>
            ${knowledge.metadata.age ? `<p><strong>年齢:</strong> ${escapeHtml(knowledge.metadata.age)}</p>` : ''}
            ${knowledge.metadata.gender ? `<p><strong>性別:</strong> ${escapeHtml(knowledge.metadata.gender)}</p>` : ''}
            ${knowledge.metadata.appearance ? `<p><strong>外見:</strong> ${escapeHtml(knowledge.metadata.appearance)}</p>` : ''}
            ${knowledge.metadata.personality ? `<p><strong>性格:</strong> ${escapeHtml(knowledge.metadata.personality)}</p>` : ''}
        `;
    } else if (knowledge.category === 'location' && knowledge.metadata) {
        container.innerHTML = `
            <h5>場所情報</h5>
            ${knowledge.metadata.type ? `<p><strong>種類:</strong> ${escapeHtml(knowledge.metadata.type)}</p>` : ''}
            ${knowledge.metadata.features ? `<p><strong>特徴:</strong> ${escapeHtml(knowledge.metadata.features)}</p>` : ''}
        `;
    }
}

// Display detail tags
function displayDetailTags(tags) {
    const container = document.getElementById('detail-tags');
    
    if (tags.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = tags.map(tag => 
        `<span class="detail-tag">${escapeHtml(tag)}</span>`
    ).join('');
}

// Display relations
async function displayRelations(knowledgeId) {
    try {
        const relations = await window.api.invoke('knowledge:getRelations', { id: knowledgeId });
        const container = document.getElementById('detail-relations');
        
        if (relations.length === 0) {
            container.innerHTML = '<p class="empty-state">関連する知識はありません</p>';
            return;
        }
        
        container.innerHTML = relations.map(rel => `
            <a href="#" class="relation-link" onclick="showKnowledgeDetail(${rel.id}); return false;">
                <span class="relation-item-title">${escapeHtml(rel.title)}</span>
                <span class="relation-item-category">${getCategoryLabel(rel.category)}</span>
            </a>
        `).join('');
    } catch (error) {
        console.error('Failed to load relations:', error);
    }
}

// Display references
async function displayReferences(knowledgeId) {
    const container = document.getElementById('detail-references');
    // This would show where this knowledge is referenced (in chapters, etc.)
    container.innerHTML = '<p class="empty-state">参照情報は実装予定です</p>';
}

// Open add knowledge modal
function openAddKnowledgeModal() {
    document.getElementById('modal-title').textContent = '知識を追加';
    document.getElementById('knowledge-title').value = '';
    document.getElementById('knowledge-category').value = '';
    document.getElementById('knowledge-content').value = '';
    document.getElementById('knowledge-tags').value = '';
    document.getElementById('knowledge-importance').value = 'medium';
    
    // Clear category fields
    document.querySelectorAll('.category-fields').forEach(field => {
        field.style.display = 'none';
    });
    
    // Clear relations
    document.getElementById('related-knowledge').innerHTML = 
        '<button class="add-relation-btn" onclick="showRelationPicker()">+ 関連付けを追加</button>';
    
    currentKnowledge = null;
    document.getElementById('knowledge-modal').style.display = 'flex';
}

// Handle modal category change
function handleModalCategoryChange(event) {
    const category = event.target.value;
    
    // Hide all category fields
    document.querySelectorAll('.category-fields').forEach(field => {
        field.style.display = 'none';
    });
    
    // Show relevant fields
    if (category === 'character') {
        document.getElementById('character-fields').style.display = 'block';
    } else if (category === 'location') {
        document.getElementById('location-fields').style.display = 'block';
    }
}

// Save knowledge
window.saveKnowledge = async function() {
    const title = document.getElementById('knowledge-title').value.trim();
    const category = document.getElementById('knowledge-category').value;
    const content = document.getElementById('knowledge-content').value.trim();
    const tags = document.getElementById('knowledge-tags').value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    const importance = document.getElementById('knowledge-importance').value;
    
    if (!title || !category || !content) {
        window.api.showMessage('必須項目を入力してください', 'warning');
        return;
    }
    
    const knowledgeData = {
        projectId: currentProject,
        title,
        category,
        content,
        tags,
        importance,
        metadata: {}
    };
    
    // Add category-specific metadata
    if (category === 'character') {
        knowledgeData.metadata = {
            age: document.getElementById('character-age').value,
            gender: document.getElementById('character-gender').value,
            appearance: document.getElementById('character-appearance').value,
            personality: document.getElementById('character-personality').value
        };
    } else if (category === 'location') {
        knowledgeData.metadata = {
            type: document.getElementById('location-type').value,
            features: document.getElementById('location-features').value
        };
    }
    
    try {
        if (currentKnowledge) {
            // Update existing
            await window.api.invoke('knowledge:update', {
                id: currentKnowledge.id,
                data: knowledgeData
            });
            window.api.showMessage('知識を更新しました', 'success');
        } else {
            // Create new
            await window.api.invoke('knowledge:create', knowledgeData);
            window.api.showMessage('知識を追加しました', 'success');
        }
        
        closeKnowledgeModal();
        await loadKnowledge();
    } catch (error) {
        console.error('Failed to save knowledge:', error);
        window.api.showMessage('保存に失敗しました', 'error');
    }
};

// Edit knowledge
window.editKnowledge = function() {
    if (!currentKnowledge) return;
    
    document.getElementById('modal-title').textContent = '知識を編集';
    document.getElementById('knowledge-title').value = currentKnowledge.title;
    document.getElementById('knowledge-category').value = currentKnowledge.category;
    document.getElementById('knowledge-content').value = currentKnowledge.content;
    document.getElementById('knowledge-tags').value = (currentKnowledge.tags || []).join(', ');
    document.getElementById('knowledge-importance').value = currentKnowledge.importance;
    
    // Trigger category change to show fields
    handleModalCategoryChange({ target: { value: currentKnowledge.category } });
    
    // Fill category-specific fields
    if (currentKnowledge.category === 'character' && currentKnowledge.metadata) {
        document.getElementById('character-age').value = currentKnowledge.metadata.age || '';
        document.getElementById('character-gender').value = currentKnowledge.metadata.gender || '';
        document.getElementById('character-appearance').value = currentKnowledge.metadata.appearance || '';
        document.getElementById('character-personality').value = currentKnowledge.metadata.personality || '';
    } else if (currentKnowledge.category === 'location' && currentKnowledge.metadata) {
        document.getElementById('location-type').value = currentKnowledge.metadata.type || '';
        document.getElementById('location-features').value = currentKnowledge.metadata.features || '';
    }
    
    closeDetailModal();
    document.getElementById('knowledge-modal').style.display = 'flex';
};

// Delete knowledge
window.deleteKnowledge = async function() {
    if (!currentKnowledge) return;
    
    if (!confirm('この知識を削除しますか？')) return;
    
    try {
        await window.api.invoke('knowledge:delete', { id: currentKnowledge.id });
        window.api.showMessage('知識を削除しました', 'success');
        closeDetailModal();
        await loadKnowledge();
    } catch (error) {
        console.error('Failed to delete knowledge:', error);
        window.api.showMessage('削除に失敗しました', 'error');
    }
};

// Search handling
async function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    
    if (!query) {
        filterKnowledge();
        return;
    }
    
    filteredItems = knowledgeItems.filter(item => {
        return item.title.toLowerCase().includes(query) ||
               item.content.toLowerCase().includes(query) ||
               (item.tags || []).some(tag => tag.toLowerCase().includes(query));
    });
    
    displayKnowledge(filteredItems);
}

// Toggle filters
function toggleFilters() {
    const panel = document.getElementById('filter-panel');
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

// Load tag filters
function loadTagFilters() {
    const allTags = new Set();
    knowledgeItems.forEach(item => {
        (item.tags || []).forEach(tag => allTags.add(tag));
    });
    
    const container = document.getElementById('tag-filters');
    container.innerHTML = Array.from(allTags).map(tag => `
        <button class="tag-filter ${selectedTags.has(tag) ? 'active' : ''}" 
                onclick="toggleTagFilter('${tag}')">
            ${escapeHtml(tag)}
        </button>
    `).join('');
}

// Toggle tag filter
window.toggleTagFilter = function(tag) {
    if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
    } else {
        selectedTags.add(tag);
    }
    
    loadTagFilters();
    filterKnowledge();
};

// Handle importance filter
function handleImportanceFilter(event) {
    const importance = event.target.value;
    
    if (event.target.checked) {
        selectedImportance.add(importance);
    } else {
        selectedImportance.delete(importance);
    }
    
    filterKnowledge();
}

// Show sort options
function showSortOptions() {
    // Implementation for sort options menu
    console.log('Sort options');
}

// Modal functions
window.closeKnowledgeModal = function() {
    document.getElementById('knowledge-modal').style.display = 'none';
    currentKnowledge = null;
};

window.closeDetailModal = function() {
    document.getElementById('knowledge-detail-modal').style.display = 'none';
};

window.showRelationPicker = function() {
    // Show relation picker modal
    document.getElementById('relation-picker-modal').style.display = 'flex';
    // Load available knowledge items
    loadRelationOptions();
};

window.closeRelationPicker = function() {
    document.getElementById('relation-picker-modal').style.display = 'none';
};

// Load relation options
async function loadRelationOptions() {
    const container = document.getElementById('relation-options');
    const searchInput = document.getElementById('relation-search');
    
    const items = knowledgeItems.filter(item => 
        item.id !== currentKnowledge?.id // Exclude current item
    );
    
    container.innerHTML = items.map(item => `
        <div class="relation-option" onclick="selectRelation(${item.id})">
            <div class="relation-option-info">
                <div class="relation-option-title">${escapeHtml(item.title)}</div>
                <div class="relation-option-category">${getCategoryLabel(item.category)}</div>
            </div>
        </div>
    `).join('');
}

// Select relation
window.selectRelation = function(knowledgeId) {
    // Add relation to the form
    console.log('Selected relation:', knowledgeId);
    closeRelationPicker();
};

// Utility functions
function getCategoryLabel(category) {
    const labels = {
        world: '世界設定',
        character: 'キャラクター',
        location: '場所',
        item: 'アイテム',
        event: '出来事',
        other: 'その他'
    };
    return labels[category] || category;
}

function getImportanceLabel(importance) {
    const labels = {
        high: '高',
        medium: '中',
        low: '低'
    };
    return labels[importance] || importance;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}