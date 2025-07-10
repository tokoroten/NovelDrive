// Project Workspace functionality

// Global state
let currentProject = null;
let projectStats = null;
let chapters = [];
let characters = [];
let knowledgeItems = [];
let timeline = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeWorkspace();
    initializeTabHandlers();
});

// Initialize workspace
async function initializeWorkspace() {
    try {
        // Get project ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('id');
        
        if (!projectId) {
            showError('プロジェクトIDが指定されていません');
            return;
        }
        
        // Load project data
        await loadProject(projectId);
        await loadProjectStats();
        await loadChapters();
        await loadCharacters();
        await loadKnowledge();
        await loadTimeline();
        
        // Update UI
        updateProjectHeader();
        updateOverviewTab();
        updateChaptersTab();
        updateCharactersTab();
        updateKnowledgeTab();
        updateTimelineTab();
        
    } catch (error) {
        console.error('Failed to initialize workspace:', error);
        showError('ワークスペースの初期化に失敗しました');
    }
}

// Initialize tab handlers
function initializeTabHandlers() {
    document.querySelectorAll('.workspace-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.workspace-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });
    
    // Load data for specific tabs if needed
    switch (tabName) {
        case 'chapters':
            loadChapters();
            break;
        case 'characters':
            loadCharacters();
            break;
        case 'knowledge':
            loadKnowledge();
            break;
        case 'timeline':
            loadTimeline();
            break;
    }
}

// Load project data
async function loadProject(projectId) {
    try {
        const api = window.api || window.MockAPI;
        const projects = await api.invoke('project:getAll');
        currentProject = projects.data.find(p => p.id === parseInt(projectId));
        
        if (!currentProject) {
            throw new Error('プロジェクトが見つかりません');
        }
        
        // Parse metadata
        if (currentProject.metadata) {
            try {
                currentProject.parsedMetadata = JSON.parse(currentProject.metadata);
            } catch (e) {
                currentProject.parsedMetadata = {};
            }
        }
        
    } catch (error) {
        console.error('Failed to load project:', error);
        throw error;
    }
}

// Load project statistics
async function loadProjectStats() {
    try {
        const api = window.api || window.MockAPI;
        const stats = await api.invoke('project:getStats', { projectId: currentProject.id });
        projectStats = stats.data || {
            totalWords: Math.floor(Math.random() * 25000) + 5000,
            targetWords: currentProject.parsedMetadata?.targetLength || 50000,
            chaptersCompleted: Math.floor(Math.random() * 8) + 2,
            totalChapters: currentProject.parsedMetadata?.totalChapters || 15,
            dailyWords: Math.floor(Math.random() * 1500) + 200,
            weeklyWords: Math.floor(Math.random() * 8000) + 2000,
            totalSessions: Math.floor(Math.random() * 25) + 10,
            avgDaily: Math.floor(Math.random() * 800) + 400
        };
    } catch (error) {
        console.error('Failed to load project stats:', error);
        projectStats = { totalWords: 0, targetWords: 50000 };
    }
}

// Load chapters
async function loadChapters() {
    try {
        const api = window.api || window.MockAPI;
        const result = await api.invoke('chapter:list', { projectId: currentProject.id });
        chapters = result.chapters || [
            {
                id: 1,
                title: '第1章 始まりの街',
                summary: '主人公が新しい街に到着し、冒険が始まる',
                wordCount: 2500,
                targetWords: 3000,
                status: 'completed',
                lastModified: '2024-07-05T10:30:00Z'
            },
            {
                id: 2,
                title: '第2章 出会い',
                summary: '重要なキャラクターとの出会い',
                wordCount: 1800,
                targetWords: 3000,
                status: 'in_progress',
                lastModified: '2024-07-06T09:15:00Z'
            },
            {
                id: 3,
                title: '第3章 謎の手がかり',
                summary: '物語の核心に関わる手がかりを発見',
                wordCount: 0,
                targetWords: 3500,
                status: 'planned',
                lastModified: null
            }
        ];
    } catch (error) {
        console.error('Failed to load chapters:', error);
        chapters = [];
    }
}

// Load characters
async function loadCharacters() {
    try {
        const api = window.api || window.MockAPI;
        const result = await api.invoke('knowledge:search', { 
            projectId: currentProject.id,
            category: 'character'
        });
        characters = result.results || [];
    } catch (error) {
        console.error('Failed to load characters:', error);
        characters = [];
    }
}

// Load knowledge
async function loadKnowledge() {
    try {
        const api = window.api || window.MockAPI;
        const result = await api.invoke('knowledge:list', { projectId: currentProject.id });
        knowledgeItems = result.knowledge || [];
    } catch (error) {
        console.error('Failed to load knowledge:', error);
        knowledgeItems = [];
    }
}

// Load timeline
async function loadTimeline() {
    try {
        const api = window.api || window.MockAPI;
        const result = await api.invoke('project:getTimeline', { projectId: currentProject.id });
        timeline = result.timeline || [
            {
                id: 1,
                type: 'writing',
                description: '第3章「出会い」を編集',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                details: { chapterId: 2, wordsAdded: 350 }
            },
            {
                id: 2,
                type: 'planning',
                description: 'キャラクター「エリシア」を追加',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                details: { characterId: 1 }
            },
            {
                id: 3,
                type: 'editing',
                description: 'プロット会議を実行',
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                details: { sessionType: 'plot_development' }
            }
        ];
    } catch (error) {
        console.error('Failed to load timeline:', error);
        timeline = [];
    }
}

// Update project header
function updateProjectHeader() {
    if (!currentProject) return;
    
    document.getElementById('project-name').textContent = currentProject.name;
    document.getElementById('project-description').textContent = currentProject.description;
    
    if (projectStats) {
        const progress = Math.round((projectStats.totalWords / projectStats.targetWords) * 100);
        document.getElementById('project-progress').textContent = `${progress}%`;
        document.getElementById('project-word-count').textContent = projectStats.totalWords.toLocaleString();
        document.getElementById('project-chapter-count').textContent = chapters.length;
    }
}

// Update overview tab
function updateOverviewTab() {
    if (!projectStats) return;
    
    const progress = Math.round((projectStats.totalWords / projectStats.targetWords) * 100);
    
    // Update progress circle
    const progressCircle = document.getElementById('overall-progress');
    const progressValue = progressCircle.querySelector('.progress-value');
    progressValue.textContent = `${progress}%`;
    
    // Update stats
    document.getElementById('target-words').textContent = projectStats.targetWords.toLocaleString();
    document.getElementById('current-words').textContent = projectStats.totalWords.toLocaleString();
    document.getElementById('remaining-words').textContent = (projectStats.targetWords - projectStats.totalWords).toLocaleString();
    
    // Estimate completion date
    const remainingWords = projectStats.targetWords - projectStats.totalWords;
    const avgDaily = projectStats.avgDaily || 500;
    const daysRemaining = Math.ceil(remainingWords / avgDaily);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysRemaining);
    document.getElementById('estimated-completion').textContent = completionDate.toLocaleDateString('ja-JP');
    
    // Update writing stats
    document.getElementById('daily-words').textContent = projectStats.dailyWords || 0;
    document.getElementById('weekly-words').textContent = projectStats.weeklyWords || 0;
    document.getElementById('total-sessions').textContent = projectStats.totalSessions || 0;
    document.getElementById('avg-daily').textContent = projectStats.avgDaily || 0;
    
    // Update recent activity
    updateRecentActivity();
}

// Update recent activity
function updateRecentActivity() {
    const activityContainer = document.getElementById('recent-activity');
    
    const recentActivities = timeline.slice(0, 5).map(item => {
        const timeAgo = getTimeAgo(new Date(item.timestamp));
        return `
            <div class="activity-item">
                <span class="activity-time">${timeAgo}</span>
                <span class="activity-description">${item.description}</span>
            </div>
        `;
    }).join('');
    
    activityContainer.innerHTML = recentActivities || '<p class="empty-state">アクティビティがありません</p>';
}

// Update chapters tab
function updateChaptersTab() {
    const chaptersContainer = document.getElementById('chapters-list');
    
    if (chapters.length === 0) {
        chaptersContainer.innerHTML = '<p class="empty-state">章が作成されていません</p>';
        return;
    }
    
    chaptersContainer.innerHTML = chapters.map(chapter => {
        const progress = chapter.targetWords > 0 ? Math.round((chapter.wordCount / chapter.targetWords) * 100) : 0;
        const statusClass = chapter.status === 'completed' ? 'completed' : chapter.status === 'in_progress' ? 'in-progress' : 'planned';
        const statusText = chapter.status === 'completed' ? '完了' : chapter.status === 'in_progress' ? '執筆中' : '計画中';
        
        return `
            <div class="chapter-card ${statusClass}">
                <div class="chapter-header">
                    <h4>${chapter.title}</h4>
                    <span class="chapter-status ${statusClass}">${statusText}</span>
                </div>
                <p class="chapter-summary">${chapter.summary}</p>
                <div class="chapter-stats">
                    <div class="stat">
                        <span class="stat-label">文字数:</span>
                        <span class="stat-value">${chapter.wordCount.toLocaleString()} / ${chapter.targetWords.toLocaleString()}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="chapter-actions">
                    <button class="secondary-btn" onclick="editChapter(${chapter.id})">編集</button>
                    <button class="primary-btn" onclick="openChapterEditor(${chapter.id})">執筆</button>
                </div>
            </div>
        `;
    }).join('');
}

// Update characters tab
function updateCharactersTab() {
    const charactersContainer = document.getElementById('characters-grid');
    
    if (characters.length === 0) {
        charactersContainer.innerHTML = '<p class="empty-state">キャラクターが作成されていません</p>';
        return;
    }
    
    charactersContainer.innerHTML = characters.map(character => `
        <div class="character-card">
            <div class="character-avatar">👤</div>
            <div class="character-info">
                <h4>${character.title}</h4>
                <p class="character-description">${character.content.substring(0, 100)}...</p>
                <div class="character-meta">
                    ${character.extraFields?.age ? `<span class="meta-tag">年齢: ${character.extraFields.age}</span>` : ''}
                    ${character.extraFields?.gender ? `<span class="meta-tag">${character.extraFields.gender}</span>` : ''}
                </div>
            </div>
            <div class="character-actions">
                <button class="icon-btn" onclick="editCharacter(${character.id})" title="編集">✏️</button>
                <button class="icon-btn" onclick="viewCharacterDetails(${character.id})" title="詳細">👁️</button>
            </div>
        </div>
    `).join('');
}

// Update knowledge tab
function updateKnowledgeTab() {
    const knowledgeContainer = document.getElementById('knowledge-grid');
    
    if (knowledgeItems.length === 0) {
        knowledgeContainer.innerHTML = '<p class="empty-state">知識が登録されていません</p>';
        return;
    }
    
    knowledgeContainer.innerHTML = knowledgeItems.map(item => {
        const categoryIcons = {
            world: '🌍',
            character: '👥',
            location: '📍',
            item: '🎁',
            event: '📅',
            other: '📂'
        };
        
        return `
            <div class="knowledge-card">
                <div class="knowledge-header">
                    <span class="knowledge-icon">${categoryIcons[item.category] || '📂'}</span>
                    <h4>${item.title}</h4>
                </div>
                <p class="knowledge-content">${item.content.substring(0, 120)}...</p>
                <div class="knowledge-meta">
                    <span class="category-tag">${getCategoryName(item.category)}</span>
                    <span class="importance-tag ${item.importance}">${getImportanceName(item.importance)}</span>
                </div>
                <div class="knowledge-actions">
                    <button class="icon-btn" onclick="editKnowledgeItem(${item.id})" title="編集">✏️</button>
                    <button class="icon-btn" onclick="viewKnowledgeDetails(${item.id})" title="詳細">👁️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Update timeline tab
function updateTimelineTab() {
    const timelineContainer = document.getElementById('timeline-container');
    
    if (timeline.length === 0) {
        timelineContainer.innerHTML = '<p class="empty-state">タイムラインが空です</p>';
        return;
    }
    
    timelineContainer.innerHTML = timeline.map(item => {
        const typeIcons = {
            writing: '✍️',
            editing: '✏️',
            planning: '📋',
            meeting: '🤝'
        };
        
        return `
            <div class="timeline-item ${item.type}">
                <div class="timeline-icon">${typeIcons[item.type] || '📝'}</div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-time">${getTimeAgo(new Date(item.timestamp))}</span>
                        <span class="timeline-type">${getTypeName(item.type)}</span>
                    </div>
                    <p class="timeline-description">${item.description}</p>
                    ${item.details ? `<div class="timeline-details">${formatTimelineDetails(item.details)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Helper functions
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP');
}

function getCategoryName(category) {
    const names = {
        world: '世界設定',
        character: 'キャラクター',
        location: '場所',
        item: 'アイテム',
        event: '出来事',
        other: 'その他'
    };
    return names[category] || category;
}

function getImportanceName(importance) {
    const names = { high: '高', medium: '中', low: '低' };
    return names[importance] || importance;
}

function getTypeName(type) {
    const names = {
        writing: '執筆',
        editing: '編集',
        planning: '企画',
        meeting: '会議'
    };
    return names[type] || type;
}

function formatTimelineDetails(details) {
    if (details.wordsAdded) return `+${details.wordsAdded}文字`;
    if (details.sessionType) return `セッション: ${details.sessionType}`;
    return '';
}

// Action functions
window.editProjectSettings = function() {
    window.location.href = `./project-edit.html?id=${currentProject.id}`;
};

window.startWriting = function() {
    if (chapters.length > 0) {
        const latestChapter = chapters.find(c => c.status === 'in_progress') || chapters[0];
        window.location.href = `./writing-editor.html?project=${currentProject.id}&chapter=${latestChapter.id}`;
    } else {
        createNewChapter();
    }
};

window.createNewChapter = function() {
    document.getElementById('new-chapter-modal').style.display = 'block';
    document.getElementById('chapter-order').value = chapters.length + 1;
};

window.closeNewChapterModal = function() {
    document.getElementById('new-chapter-modal').style.display = 'none';
    // Reset form
    document.getElementById('chapter-title').value = '';
    document.getElementById('chapter-summary').value = '';
    document.getElementById('target-word-count').value = '3000';
};

window.saveNewChapter = async function() {
    const title = document.getElementById('chapter-title').value.trim();
    const summary = document.getElementById('chapter-summary').value.trim();
    const order = parseInt(document.getElementById('chapter-order').value);
    const targetWords = parseInt(document.getElementById('target-word-count').value);
    
    if (!title) {
        showError('章タイトルを入力してください');
        return;
    }
    
    try {
        const newChapter = {
            projectId: currentProject.id,
            title: title,
            summary: summary,
            order: order,
            targetWords: targetWords,
            wordCount: 0,
            status: 'planned'
        };
        
        const api = window.api || window.MockAPI;
        await api.invoke('chapter:create', newChapter);
        closeNewChapterModal();
        await loadChapters();
        updateChaptersTab();
        showSuccess('新しい章を作成しました');
    } catch (error) {
        console.error('Failed to create chapter:', error);
        showError('章の作成に失敗しました');
    }
};

window.openChapterEditor = function(chapterId) {
    window.location.href = `./writing-editor.html?project=${currentProject.id}&chapter=${chapterId}`;
};

window.editChapter = function(chapterId) {
    // Implementation for chapter editing modal
    console.log('Editing chapter:', chapterId);
};

window.createNewCharacter = function() {
    window.location.href = `./project-knowledge.html?project=${currentProject.id}&category=character&action=create`;
};

window.editCharacter = function(characterId) {
    window.location.href = `./project-knowledge.html?project=${currentProject.id}&edit=${characterId}`;
};

window.viewCharacterDetails = function(characterId) {
    window.location.href = `./project-knowledge.html?project=${currentProject.id}&view=${characterId}`;
};

window.addKnowledge = function() {
    window.location.href = `./project-knowledge.html?project=${currentProject.id}&action=create`;
};

window.openKnowledgeGraph = function() {
    window.location.href = `./knowledge-graph.html?project=${currentProject.id}`;
};

window.editKnowledgeItem = function(itemId) {
    window.location.href = `./project-knowledge.html?project=${currentProject.id}&edit=${itemId}`;
};

window.viewKnowledgeDetails = function(itemId) {
    window.location.href = `./project-knowledge.html?project=${currentProject.id}&view=${itemId}`;
};

window.openAgentMeeting = function() {
    window.location.href = `./agent-meeting.html?project=${currentProject.id}`;
};

window.generateIdeas = function() {
    window.location.href = `./serendipity.html?project=${currentProject.id}`;
};

// Utility functions
function showSuccess(message) {
    const api = window.api || window.MockAPI;
    if (api && api.showMessage) {
        api.showMessage(message, 'success');
    } else {
        console.log('[Success]', message);
    }
}

function showError(message) {
    const api = window.api || window.MockAPI;
    if (api && api.showMessage) {
        api.showMessage(message, 'error');
    } else {
        console.error('[Error]', message);
    }
}

function showInfo(message) {
    const api = window.api || window.MockAPI;
    if (api && api.showMessage) {
        api.showMessage(message, 'info');
    } else {
        console.info('[Info]', message);
    }
}