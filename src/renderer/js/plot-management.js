// Plot Management functionality

// Global state
let currentProject = null;
let currentPlot = null;
let plots = [];
let isDragging = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadProjectList();
});

// Initialize event listeners
function initializeEventListeners() {
    // Project and plot selectors
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);
    document.getElementById('plot-selector').addEventListener('change', handlePlotChange);
    
    // Plot actions
    document.getElementById('new-plot').addEventListener('click', createNewPlot);
    document.getElementById('save-version').addEventListener('click', saveVersion);
    document.getElementById('view-versions').addEventListener('click', showVersionHistory);
    document.getElementById('analyze-plot').addEventListener('click', analyzePlot);
    
    // Structure tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', handleTabChange);
    });
    
    // Chapter management
    document.getElementById('add-chapter').addEventListener('click', showAddChapterModal);
    document.getElementById('reorder-chapters').addEventListener('click', toggleChapterReorder);
    
    // Character arcs
    document.getElementById('add-arc').addEventListener('click', addCharacterArc);
    
    // Timeline
    document.getElementById('add-event').addEventListener('click', addTimelineEvent);
    document.getElementById('toggle-timeline-view').addEventListener('click', toggleTimelineView);
    
    // Themes
    document.getElementById('add-theme').addEventListener('click', addTheme);
    document.getElementById('theme-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTheme();
    });
    
    // Conflicts
    document.getElementById('add-conflict').addEventListener('click', addConflict);
    
    // Auto-save on content change
    setupAutoSave();
}

// Load project list
async function loadProjectList() {
    try {
        const apiInstance = window.api || window.mockAPI;
        const response = await apiInstance.invoke('project:getAll');
        const projects = window.mockAPI && response.data ? response.data : response;
        const selector = document.getElementById('project-selector');
        
        selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load projects:', error);
        window.api.showMessage('プロジェクトの読み込みに失敗しました', 'error');
    }
}

// Handle project selection
async function handleProjectChange(event) {
    const projectId = event.target.value;
    if (!projectId) {
        currentProject = null;
        document.getElementById('new-plot').disabled = true;
        document.getElementById('plot-selector').disabled = true;
        document.getElementById('plot-content').style.display = 'none';
        return;
    }
    
    currentProject = projectId;
    document.getElementById('new-plot').disabled = false;
    document.getElementById('plot-selector').disabled = false;
    
    await loadPlots(projectId);
}

// Load plots for project
async function loadPlots(projectId) {
    try {
        plots = await window.api.invoke('plot:list', { projectId });
        const selector = document.getElementById('plot-selector');
        
        selector.innerHTML = '<option value="">プロットを選択...</option>';
        plots.forEach(plot => {
            const option = document.createElement('option');
            option.value = plot.id;
            option.textContent = `${plot.title} (v${plot.version})`;
            selector.appendChild(option);
        });
        
        // Load characters for the project
        await loadCharacters(projectId);
        
    } catch (error) {
        console.error('Failed to load plots:', error);
        window.api.showMessage('プロットの読み込みに失敗しました', 'error');
    }
}

// Handle plot selection
async function handlePlotChange(event) {
    const plotId = event.target.value;
    if (!plotId) {
        currentPlot = null;
        document.getElementById('plot-content').style.display = 'none';
        disablePlotActions();
        return;
    }
    
    try {
        currentPlot = await window.api.invoke('plot:get', { id: plotId });
        displayPlot(currentPlot);
        enablePlotActions();
    } catch (error) {
        console.error('Failed to load plot:', error);
        window.api.showMessage('プロットの読み込みに失敗しました', 'error');
    }
}

// Display plot details
function displayPlot(plot) {
    document.getElementById('plot-content').style.display = 'block';
    
    // Basic info
    document.getElementById('plot-title').value = plot.title || '';
    document.getElementById('plot-premise').value = plot.premise || '';
    
    // Structure
    if (plot.structure) {
        displayStructure(plot.structure);
    }
    
    // Chapters
    displayChapters(plot.chapters || []);
    
    // Character arcs
    displayCharacterArcs(plot.characterArcs || {});
    
    // Timeline
    displayTimeline(plot.timeline || []);
    
    // Themes
    displayThemes(plot.themes || []);
    
    // Conflicts
    displayConflicts(plot.conflicts || []);
}

// Display structure
function displayStructure(structure) {
    // Three act structure
    if (structure.acts) {
        document.querySelector('[data-act="1"]').value = structure.acts[0] || '';
        document.querySelector('[data-act="2"]').value = structure.acts[1] || '';
        document.querySelector('[data-act="3"]').value = structure.acts[2] || '';
    }
}

// Display chapters
function displayChapters(chapters) {
    const container = document.getElementById('chapters-list');
    
    if (chapters.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>まだ章が作成されていません</p></div>';
        return;
    }
    
    container.innerHTML = chapters.map((chapter, index) => `
        <div class="chapter-item" data-chapter-id="${chapter.id}" draggable="true">
            <div class="chapter-number">${index + 1}</div>
            <div class="chapter-content">
                <div class="chapter-title">${escapeHtml(chapter.title)}</div>
                <div class="chapter-summary">${escapeHtml(chapter.summary || '')}</div>
            </div>
            <div class="chapter-type" data-type="${chapter.type}">${getChapterTypeLabel(chapter.type)}</div>
            <div class="chapter-actions">
                <button onclick="editChapter(${chapter.id})" title="編集">✏️</button>
                <button onclick="deleteChapter(${chapter.id})" title="削除">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // Setup drag and drop
    setupChapterDragAndDrop();
}

// Display character arcs
function displayCharacterArcs(arcs) {
    const container = document.getElementById('character-arcs-container');
    const characters = Object.entries(arcs);
    
    if (characters.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>キャラクターアークが設定されていません</p></div>';
        return;
    }
    
    container.innerHTML = characters.map(([character, arc]) => `
        <div class="arc-card" data-character="${character}">
            <h4>${escapeHtml(character)}</h4>
            <div class="arc-stages">
                <div class="arc-stage">
                    <span class="arc-stage-label">開始:</span>
                    <input type="text" class="arc-stage-content" data-stage="start" 
                           value="${escapeHtml(arc.start || '')}" 
                           onchange="updateCharacterArc('${character}', 'start', this.value)">
                </div>
                <div class="arc-stage">
                    <span class="arc-stage-label">中間:</span>
                    <input type="text" class="arc-stage-content" data-stage="middle" 
                           value="${escapeHtml(arc.middle || '')}"
                           onchange="updateCharacterArc('${character}', 'middle', this.value)">
                </div>
                <div class="arc-stage">
                    <span class="arc-stage-label">終了:</span>
                    <input type="text" class="arc-stage-content" data-stage="end" 
                           value="${escapeHtml(arc.end || '')}"
                           onchange="updateCharacterArc('${character}', 'end', this.value)">
                </div>
            </div>
        </div>
    `).join('');
}

// Display timeline
function displayTimeline(events) {
    const container = document.getElementById('timeline-container');
    
    if (events.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>タイムラインイベントがありません</p></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="timeline-line"></div>
        ${events.map(event => `
            <div class="timeline-event" data-event-id="${event.id}">
                <div class="timeline-date">${formatDate(event.date)}</div>
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-event-title">${escapeHtml(event.title)}</div>
                    <div class="timeline-event-description">${escapeHtml(event.description)}</div>
                </div>
            </div>
        `).join('')}
    `;
}

// Display themes
function displayThemes(themes) {
    const container = document.getElementById('themes-list');
    
    if (themes.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>テーマが設定されていません</p></div>';
        return;
    }
    
    container.innerHTML = themes.map(theme => `
        <div class="theme-tag">
            ${escapeHtml(theme)}
            <button onclick="removeTheme('${theme}')" title="削除">×</button>
        </div>
    `).join('');
}

// Display conflicts
function displayConflicts(conflicts) {
    const container = document.getElementById('conflicts-list');
    
    if (conflicts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>葛藤・対立が設定されていません</p></div>';
        return;
    }
    
    container.innerHTML = conflicts.map(conflict => `
        <div class="conflict-item ${conflict.resolved ? 'resolved' : ''}" data-conflict-id="${conflict.id}">
            <div class="conflict-header">
                <div class="conflict-title">${escapeHtml(conflict.title)}</div>
                <div class="conflict-status ${conflict.resolved ? 'resolved' : 'active'}">
                    ${conflict.resolved ? '解決済み' : '未解決'}
                </div>
            </div>
            <div class="conflict-description">${escapeHtml(conflict.description)}</div>
            ${conflict.resolved && conflict.resolution ? 
                `<div class="conflict-resolution">解決: ${escapeHtml(conflict.resolution)}</div>` : 
                `<button class="secondary-btn" onclick="resolveConflict(${conflict.id})">解決する</button>`
            }
        </div>
    `).join('');
}

// Create new plot
async function createNewPlot() {
    const title = prompt('新しいプロットのタイトルを入力してください:');
    if (!title) return;
    
    try {
        const newPlot = await window.api.invoke('plot:create', {
            projectId: currentProject,
            title: title,
            premise: '',
            structure: { acts: ['', '', ''] }
        });
        
        await loadPlots(currentProject);
        document.getElementById('plot-selector').value = newPlot.id;
        await handlePlotChange({ target: { value: newPlot.id } });
        
        window.api.showMessage('プロットを作成しました', 'success');
    } catch (error) {
        console.error('Failed to create plot:', error);
        window.api.showMessage('プロットの作成に失敗しました', 'error');
    }
}

// Save plot version
async function saveVersion() {
    if (!currentPlot) return;
    
    const changes = prompt('この版の変更点を簡単に説明してください:');
    if (!changes) return;
    
    try {
        const updatedPlot = await window.api.invoke('plot:saveVersion', {
            id: currentPlot.id,
            versionData: {
                ...collectPlotData(),
                changes: [changes]
            }
        });
        
        currentPlot = updatedPlot;
        await loadPlots(currentProject);
        
        window.api.showMessage(`バージョン ${updatedPlot.version} を保存しました`, 'success');
    } catch (error) {
        console.error('Failed to save version:', error);
        window.api.showMessage('バージョンの保存に失敗しました', 'error');
    }
}

// Collect current plot data
function collectPlotData() {
    const structure = {
        acts: [
            document.querySelector('[data-act="1"]').value,
            document.querySelector('[data-act="2"]').value,
            document.querySelector('[data-act="3"]').value
        ]
    };
    
    return {
        title: document.getElementById('plot-title').value,
        premise: document.getElementById('plot-premise').value,
        structure: structure
    };
}

// Setup auto-save
function setupAutoSave() {
    let saveTimeout;
    
    const autoSaveElements = [
        'plot-title',
        'plot-premise'
    ];
    
    autoSaveElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(saveCurrentPlot, 2000);
            });
        }
    });
    
    // Act content auto-save
    document.querySelectorAll('.act-content').forEach(textarea => {
        textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveCurrentPlot, 2000);
        });
    });
}

// Save current plot
async function saveCurrentPlot() {
    if (!currentPlot) return;
    
    try {
        const plotData = collectPlotData();
        await window.api.invoke('plot:update', {
            id: currentPlot.id,
            data: plotData
        });
        
        // Update in-memory plot
        Object.assign(currentPlot, plotData);
        
        console.log('Plot auto-saved');
    } catch (error) {
        console.error('Failed to auto-save plot:', error);
    }
}

// Chapter management
function showAddChapterModal() {
    document.getElementById('chapter-modal-title').textContent = '章を追加';
    document.getElementById('chapter-title').value = '';
    document.getElementById('chapter-summary').value = '';
    document.getElementById('chapter-type').value = 'setup';
    document.getElementById('chapter-modal').style.display = 'flex';
    
    window.currentChapterId = null;
}

window.editChapter = function(chapterId) {
    const chapter = currentPlot.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    
    document.getElementById('chapter-modal-title').textContent = '章を編集';
    document.getElementById('chapter-title').value = chapter.title;
    document.getElementById('chapter-summary').value = chapter.summary || '';
    document.getElementById('chapter-type').value = chapter.type;
    document.getElementById('chapter-modal').style.display = 'flex';
    
    window.currentChapterId = chapterId;
};

window.deleteChapter = async function(chapterId) {
    if (!confirm('この章を削除しますか？')) return;
    
    try {
        currentPlot.chapters = currentPlot.chapters.filter(ch => ch.id !== chapterId);
        await saveCurrentPlot();
        displayChapters(currentPlot.chapters);
        
        window.api.showMessage('章を削除しました', 'success');
    } catch (error) {
        console.error('Failed to delete chapter:', error);
        window.api.showMessage('章の削除に失敗しました', 'error');
    }
};

window.saveChapter = async function() {
    const title = document.getElementById('chapter-title').value;
    const summary = document.getElementById('chapter-summary').value;
    const type = document.getElementById('chapter-type').value;
    
    if (!title) {
        window.api.showMessage('章タイトルを入力してください', 'warning');
        return;
    }
    
    try {
        if (window.currentChapterId) {
            // Update existing chapter
            await window.api.invoke('plot:updateChapter', {
                plotId: currentPlot.id,
                chapterId: window.currentChapterId,
                data: { title, summary, type }
            });
        } else {
            // Add new chapter
            await window.api.invoke('plot:addChapter', {
                plotId: currentPlot.id,
                data: { title, summary, type }
            });
        }
        
        // Reload plot
        currentPlot = await window.api.invoke('plot:get', { id: currentPlot.id });
        displayChapters(currentPlot.chapters);
        
        closeChapterModal();
        window.api.showMessage('章を保存しました', 'success');
    } catch (error) {
        console.error('Failed to save chapter:', error);
        window.api.showMessage('章の保存に失敗しました', 'error');
    }
};

window.closeChapterModal = function() {
    document.getElementById('chapter-modal').style.display = 'none';
    window.currentChapterId = null;
};

// Setup chapter drag and drop
function setupChapterDragAndDrop() {
    const chapters = document.querySelectorAll('.chapter-item');
    
    chapters.forEach(chapter => {
        chapter.addEventListener('dragstart', handleDragStart);
        chapter.addEventListener('dragend', handleDragEnd);
        chapter.addEventListener('dragover', handleDragOver);
        chapter.addEventListener('drop', handleDrop);
    });
}

let draggedChapter = null;

function handleDragStart(e) {
    draggedChapter = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedChapter !== this) {
        const allChapters = Array.from(document.querySelectorAll('.chapter-item'));
        const draggedIndex = allChapters.indexOf(draggedChapter);
        const targetIndex = allChapters.indexOf(this);
        
        // Reorder chapters
        const newOrder = currentPlot.chapters.map(ch => ch.id);
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, removed);
        
        try {
            await window.api.invoke('plot:reorderChapters', {
                plotId: currentPlot.id,
                chapterOrder: newOrder
            });
            
            // Reload plot
            currentPlot = await window.api.invoke('plot:get', { id: currentPlot.id });
            displayChapters(currentPlot.chapters);
        } catch (error) {
            console.error('Failed to reorder chapters:', error);
            window.api.showMessage('章の並び替えに失敗しました', 'error');
        }
    }
    
    return false;
}

// Tab handling
function handleTabChange(event) {
    const tabBtn = event.target;
    const tabName = tabBtn.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');
    
    // Show corresponding content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

// Character arc management
async function loadCharacters(projectId) {
    try {
        const characters = await window.api.invoke('character:list', { projectId });
        const selector = document.getElementById('character-selector');
        
        selector.innerHTML = '<option value="">キャラクターを選択...</option>';
        characters.forEach(character => {
            const option = document.createElement('option');
            option.value = character.name;
            option.textContent = character.name;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load characters:', error);
    }
}

async function addCharacterArc() {
    const characterName = document.getElementById('character-selector').value;
    if (!characterName) {
        window.api.showMessage('キャラクターを選択してください', 'warning');
        return;
    }
    
    if (currentPlot.characterArcs[characterName]) {
        window.api.showMessage('このキャラクターのアークは既に存在します', 'warning');
        return;
    }
    
    try {
        await window.api.invoke('plot:updateCharacterArc', {
            plotId: currentPlot.id,
            characterName: characterName,
            arcData: { start: '', middle: '', end: '' }
        });
        
        currentPlot = await window.api.invoke('plot:get', { id: currentPlot.id });
        displayCharacterArcs(currentPlot.characterArcs);
        
        window.api.showMessage('キャラクターアークを追加しました', 'success');
    } catch (error) {
        console.error('Failed to add character arc:', error);
        window.api.showMessage('キャラクターアークの追加に失敗しました', 'error');
    }
}

window.updateCharacterArc = async function(character, stage, value) {
    try {
        const arcData = currentPlot.characterArcs[character];
        arcData[stage] = value;
        
        await window.api.invoke('plot:updateCharacterArc', {
            plotId: currentPlot.id,
            characterName: character,
            arcData: arcData
        });
        
        currentPlot.characterArcs[character] = arcData;
    } catch (error) {
        console.error('Failed to update character arc:', error);
    }
};

// Timeline management
async function addTimelineEvent() {
    const title = prompt('イベントのタイトル:');
    if (!title) return;
    
    const date = prompt('日付 (例: Day 1, Chapter 3, 2024-01-01):');
    if (!date) return;
    
    const description = prompt('イベントの説明:');
    
    try {
        await window.api.invoke('plot:addTimelineEvent', {
            plotId: currentPlot.id,
            event: { title, date, description }
        });
        
        currentPlot = await window.api.invoke('plot:get', { id: currentPlot.id });
        displayTimeline(currentPlot.timeline);
        
        window.api.showMessage('タイムラインイベントを追加しました', 'success');
    } catch (error) {
        console.error('Failed to add timeline event:', error);
        window.api.showMessage('イベントの追加に失敗しました', 'error');
    }
}

function toggleTimelineView() {
    // Toggle between different timeline views (implementation pending)
    console.log('Timeline view toggle');
}

// Theme management
async function addTheme() {
    const input = document.getElementById('theme-input');
    const theme = input.value.trim();
    
    if (!theme) return;
    
    if (currentPlot.themes.includes(theme)) {
        window.api.showMessage('このテーマは既に追加されています', 'warning');
        return;
    }
    
    try {
        const updatedThemes = [...currentPlot.themes, theme];
        await window.api.invoke('plot:updateThemes', {
            plotId: currentPlot.id,
            themes: updatedThemes
        });
        
        currentPlot.themes = updatedThemes;
        displayThemes(updatedThemes);
        input.value = '';
        
        window.api.showMessage('テーマを追加しました', 'success');
    } catch (error) {
        console.error('Failed to add theme:', error);
        window.api.showMessage('テーマの追加に失敗しました', 'error');
    }
}

window.removeTheme = async function(theme) {
    try {
        const updatedThemes = currentPlot.themes.filter(t => t !== theme);
        await window.api.invoke('plot:updateThemes', {
            plotId: currentPlot.id,
            themes: updatedThemes
        });
        
        currentPlot.themes = updatedThemes;
        displayThemes(updatedThemes);
    } catch (error) {
        console.error('Failed to remove theme:', error);
        window.api.showMessage('テーマの削除に失敗しました', 'error');
    }
};

// Conflict management
async function addConflict() {
    const title = prompt('葛藤・対立のタイトル:');
    if (!title) return;
    
    const description = prompt('詳細な説明:');
    if (!description) return;
    
    try {
        await window.api.invoke('plot:addConflict', {
            plotId: currentPlot.id,
            conflict: { title, description }
        });
        
        currentPlot = await window.api.invoke('plot:get', { id: currentPlot.id });
        displayConflicts(currentPlot.conflicts);
        
        window.api.showMessage('葛藤を追加しました', 'success');
    } catch (error) {
        console.error('Failed to add conflict:', error);
        window.api.showMessage('葛藤の追加に失敗しました', 'error');
    }
}

window.resolveConflict = async function(conflictId) {
    const resolution = prompt('どのように解決されましたか？');
    if (!resolution) return;
    
    try {
        await window.api.invoke('plot:resolveConflict', {
            plotId: currentPlot.id,
            conflictId: conflictId,
            resolution: resolution
        });
        
        currentPlot = await window.api.invoke('plot:get', { id: currentPlot.id });
        displayConflicts(currentPlot.conflicts);
        
        window.api.showMessage('葛藤を解決しました', 'success');
    } catch (error) {
        console.error('Failed to resolve conflict:', error);
        window.api.showMessage('葛藤の解決に失敗しました', 'error');
    }
};

// Plot analysis
async function analyzePlot() {
    if (!currentPlot) return;
    
    try {
        const analysis = await window.api.invoke('plot:analyze', { id: currentPlot.id });
        displayAnalysis(analysis);
        document.getElementById('plot-analysis').style.display = 'flex';
    } catch (error) {
        console.error('Failed to analyze plot:', error);
        window.api.showMessage('プロット分析に失敗しました', 'error');
    }
}

function displayAnalysis(analysis) {
    const content = document.getElementById('analysis-content');
    
    content.innerHTML = `
        <div class="analysis-section">
            <h4>完成度</h4>
            <div class="analysis-score">
                <div class="score-bar">
                    <div class="score-fill" style="width: ${analysis.completeness.score}%"></div>
                </div>
                <div class="score-value">${Math.round(analysis.completeness.score)}%</div>
            </div>
        </div>
        
        <div class="analysis-section">
            <h4>ペーシング</h4>
            <div class="analysis-score">
                <div class="score-bar">
                    <div class="score-fill" style="width: ${analysis.pacing.score}%"></div>
                </div>
                <div class="score-value">${Math.round(analysis.pacing.score)}%</div>
            </div>
        </div>
        
        <div class="analysis-section">
            <h4>キャラクター成長</h4>
            <div class="analysis-score">
                <div class="score-bar">
                    <div class="score-fill" style="width: ${analysis.characterDevelopment.score}%"></div>
                </div>
                <div class="score-value">${Math.round(analysis.characterDevelopment.score)}%</div>
            </div>
        </div>
        
        <div class="analysis-section">
            <h4>提案</h4>
            <div class="analysis-suggestions">
                ${analysis.suggestions.map(suggestion => `
                    <div class="suggestion-item">
                        <span class="suggestion-priority ${suggestion.priority}">${getPriorityLabel(suggestion.priority)}</span>
                        <span class="suggestion-message">${escapeHtml(suggestion.message)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.closePlotAnalysis = function() {
    document.getElementById('plot-analysis').style.display = 'none';
};

// Version history
async function showVersionHistory() {
    if (!currentPlot || !currentPlot.versions) {
        window.api.showMessage('バージョン履歴がありません', 'info');
        return;
    }
    
    const versionList = document.getElementById('version-list');
    versionList.innerHTML = currentPlot.versions.map(version => `
        <div class="version-item" onclick="loadVersion(${version.version})">
            <div class="version-number">v${version.version}</div>
            <div class="version-details">
                <div class="version-date">${formatDateTime(version.archivedAt)}</div>
                <div class="version-changes">${version.data.title || 'Untitled'}</div>
            </div>
            <div class="version-actions">
                <button class="secondary-btn" onclick="event.stopPropagation(); restoreVersion(${version.version})">復元</button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('version-history').style.display = 'flex';
}

window.closeVersionHistory = function() {
    document.getElementById('version-history').style.display = 'none';
};

window.loadVersion = function(versionNumber) {
    // Preview version (implementation pending)
    console.log('Loading version:', versionNumber);
};

window.restoreVersion = function(versionNumber) {
    if (!confirm(`バージョン ${versionNumber} に復元しますか？現在の変更は新しいバージョンとして保存されます。`)) {
        return;
    }
    
    // Restore version (implementation pending)
    console.log('Restoring version:', versionNumber);
};

// Utility functions
function enablePlotActions() {
    document.getElementById('save-version').disabled = false;
    document.getElementById('view-versions').disabled = false;
    document.getElementById('analyze-plot').disabled = false;
}

function disablePlotActions() {
    document.getElementById('save-version').disabled = true;
    document.getElementById('view-versions').disabled = true;
    document.getElementById('analyze-plot').disabled = true;
}

function toggleChapterReorder() {
    isDragging = !isDragging;
    const chapters = document.querySelectorAll('.chapter-item');
    chapters.forEach(chapter => {
        chapter.draggable = isDragging;
        chapter.style.cursor = isDragging ? 'move' : 'default';
    });
    
    document.getElementById('reorder-chapters').classList.toggle('active', isDragging);
}

function getChapterTypeLabel(type) {
    const labels = {
        setup: '設定',
        rising_action: '展開',
        climax: 'クライマックス',
        falling_action: '収束',
        resolution: '解決'
    };
    return labels[type] || type;
}

function getPriorityLabel(priority) {
    const labels = {
        high: '高',
        medium: '中',
        low: '低'
    };
    return labels[priority] || priority;
}

function formatDate(dateStr) {
    // Simple date formatting
    return dateStr;
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}