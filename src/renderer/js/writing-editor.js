// Writing Editor functionality

// Global state
let currentProject = null;
let currentPlot = null;
let currentChapter = null;
let editorContent = '';
let isDirty = false;
let autoSaveTimer = null;
let writingStats = {
    totalChars: 0,
    todayChars: 0,
    sessionStart: new Date()
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadProjects();
    loadWritingStats();
    setupAutoSave();
    setupKeyboardShortcuts();
});

// Initialize event listeners
function initializeEventListeners() {
    // Editor
    const editor = document.getElementById('editor');
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('selectionchange', handleSelectionChange);
    
    // Toolbar
    document.getElementById('save-content').addEventListener('click', saveContent);
    document.getElementById('undo').addEventListener('click', () => document.execCommand('undo'));
    document.getElementById('redo').addEventListener('click', () => document.execCommand('redo'));
    document.getElementById('toggle-preview').addEventListener('click', togglePreview);
    document.getElementById('toggle-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('ai-assist').addEventListener('click', openAIAssist);
    
    // Plot selector
    document.getElementById('plot-selector').addEventListener('change', handlePlotChange);
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', handleTabChange);
    });
    
    // Scene management
    document.querySelector('.add-scene-btn').addEventListener('click', () => {
        document.getElementById('scene-modal').style.display = 'flex';
    });
    
    // Knowledge search
    document.getElementById('knowledge-search').addEventListener('input', handleKnowledgeSearch);
    
    // Chapter notes
    document.getElementById('chapter-notes').addEventListener('input', handleNotesChange);
    
    // AI assist options
    document.querySelectorAll('.assist-option').forEach(option => {
        option.addEventListener('click', handleAIAssistOption);
    });
}

// Load projects for plot selection
async function loadProjects() {
    try {
        const projects = await window.api.invoke('project:list');
        // Get current project from localStorage or URL params
        const projectId = localStorage.getItem('currentProjectId');
        if (projectId) {
            currentProject = projects.find(p => p.id === parseInt(projectId));
            if (currentProject) {
                await loadPlots(currentProject.id);
            }
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// Load plots for current project
async function loadPlots(projectId) {
    try {
        const plots = await window.api.invoke('plot:list', { projectId });
        const selector = document.getElementById('plot-selector');
        
        selector.innerHTML = '<option value="">プロットを選択...</option>';
        plots.forEach(plot => {
            const option = document.createElement('option');
            option.value = plot.id;
            option.textContent = plot.title;
            selector.appendChild(option);
        });
        
        // Auto-select if only one plot
        if (plots.length === 1) {
            selector.value = plots[0].id;
            await handlePlotChange({ target: selector });
        }
    } catch (error) {
        console.error('Failed to load plots:', error);
    }
}

// Handle plot selection
async function handlePlotChange(event) {
    const plotId = event.target.value;
    if (!plotId) {
        currentPlot = null;
        displayChapters([]);
        return;
    }
    
    try {
        currentPlot = await window.api.invoke('plot:get', { id: plotId });
        displayChapters(currentPlot.chapters || []);
        
        // Auto-select first chapter if exists
        if (currentPlot.chapters && currentPlot.chapters.length > 0) {
            await loadChapter(currentPlot.chapters[0].id);
        }
    } catch (error) {
        console.error('Failed to load plot:', error);
        window.api.showMessage('プロットの読み込みに失敗しました', 'error');
    }
}

// Display chapters in navigation
function displayChapters(chapters) {
    const container = document.getElementById('chapters-list');
    
    if (chapters.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>章がありません</p></div>';
        return;
    }
    
    container.innerHTML = chapters.map((chapter, index) => `
        <div class="chapter-nav-item ${chapter.id === currentChapter?.id ? 'active' : ''}" 
             data-chapter-id="${chapter.id}"
             onclick="loadChapter(${chapter.id})">
            <span class="chapter-nav-number">${index + 1}</span>
            <span class="chapter-nav-title">${escapeHtml(chapter.title)}</span>
            <span class="chapter-nav-status">${chapter.wordCount || 0}字</span>
        </div>
    `).join('');
}

// Load chapter content
async function loadChapter(chapterId) {
    // Save current chapter if dirty
    if (isDirty && currentChapter) {
        await saveContent();
    }
    
    try {
        const chapter = currentPlot.chapters.find(ch => ch.id === chapterId);
        if (!chapter) return;
        
        currentChapter = chapter;
        
        // Update UI
        document.getElementById('chapter-title').textContent = chapter.title;
        document.getElementById('chapter-number').textContent = `第${currentPlot.chapters.indexOf(chapter) + 1}章`;
        
        // Load chapter content
        const content = await window.api.invoke('chapter:getContent', { 
            plotId: currentPlot.id, 
            chapterId: chapter.id 
        });
        
        document.getElementById('editor').value = content || '';
        editorContent = content || '';
        isDirty = false;
        
        // Update active state
        document.querySelectorAll('.chapter-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.chapterId === String(chapterId));
        });
        
        // Load chapter outline and notes
        displayChapterOutline(chapter);
        loadChapterNotes(chapter);
        
        // Update stats
        updateCharacterCount();
        
    } catch (error) {
        console.error('Failed to load chapter:', error);
        window.api.showMessage('章の読み込みに失敗しました', 'error');
    }
}

// Handle editor input
function handleEditorInput(event) {
    editorContent = event.target.value;
    isDirty = true;
    
    // Update character count
    updateCharacterCount();
    
    // Update cursor position
    updateCursorPosition();
    
    // Update last saved status
    document.getElementById('last-saved').textContent = '未保存';
}

// Update character count
function updateCharacterCount() {
    const text = document.getElementById('editor').value;
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    
    document.getElementById('char-count').textContent = charCount.toLocaleString();
    document.getElementById('word-count').textContent = wordCount.toLocaleString();
    document.getElementById('current-chapter-chars').textContent = charCount.toLocaleString();
    
    // Update today's writing
    const todayChars = charCount - (currentChapter?.wordCount || 0);
    if (todayChars > 0) {
        writingStats.todayChars += todayChars;
        document.getElementById('today-chars').textContent = writingStats.todayChars.toLocaleString();
    }
}

// Update cursor position
function updateCursorPosition() {
    const editor = document.getElementById('editor');
    const text = editor.value;
    const selectionStart = editor.selectionStart;
    
    // Calculate line and column
    const lines = text.substring(0, selectionStart).split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;
    
    document.getElementById('line-number').textContent = lineNumber;
    document.getElementById('column-number').textContent = columnNumber;
}

// Save content
async function saveContent() {
    if (!currentChapter || !isDirty) return;
    
    try {
        const content = document.getElementById('editor').value;
        
        await window.api.invoke('chapter:saveContent', {
            plotId: currentPlot.id,
            chapterId: currentChapter.id,
            content: content
        });
        
        // Update chapter word count
        currentChapter.wordCount = content.length;
        await window.api.invoke('plot:updateChapter', {
            plotId: currentPlot.id,
            chapterId: currentChapter.id,
            data: { wordCount: content.length }
        });
        
        isDirty = false;
        document.getElementById('last-saved').textContent = `保存済み ${new Date().toLocaleTimeString('ja-JP')}`;
        
        // Update chapter list
        displayChapters(currentPlot.chapters);
        
        // Update total stats
        await updateTotalStats();
        
    } catch (error) {
        console.error('Failed to save content:', error);
        window.api.showMessage('保存に失敗しました', 'error');
    }
}

// Setup auto-save
function setupAutoSave() {
    setInterval(() => {
        if (isDirty) {
            saveContent();
        }
    }, 30000); // Auto-save every 30 seconds
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveContent();
        }
        
        // Ctrl/Cmd + P: Preview
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            togglePreview();
        }
        
        // F11: Fullscreen
        if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
        }
        
        // Ctrl/Cmd + Space: AI assist
        if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
            e.preventDefault();
            openAIAssist();
        }
    });
}

// Toggle preview mode
function togglePreview() {
    const editorWrapper = document.getElementById('editor-wrapper');
    const previewWrapper = document.getElementById('preview-wrapper');
    const preview = document.getElementById('preview');
    const button = document.getElementById('toggle-preview');
    
    if (previewWrapper.style.display === 'none') {
        // Show preview
        const content = document.getElementById('editor').value;
        preview.innerHTML = convertToHTML(content);
        
        editorWrapper.style.display = 'none';
        previewWrapper.style.display = 'block';
        button.classList.add('active');
    } else {
        // Show editor
        editorWrapper.style.display = 'block';
        previewWrapper.style.display = 'none';
        button.classList.remove('active');
    }
}

// Convert text to HTML for preview
function convertToHTML(text) {
    // Basic markdown-like conversion
    let html = escapeHtml(text);
    
    // Paragraphs
    html = html.split('\n\n').map(para => `<p>${para}</p>`).join('\n');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// Toggle fullscreen mode
function toggleFullscreen() {
    document.body.classList.toggle('fullscreen');
    const button = document.getElementById('toggle-fullscreen');
    button.classList.toggle('active');
}

// Open AI assist modal
function openAIAssist() {
    const editor = document.getElementById('editor');
    const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    
    document.getElementById('selected-text-preview').textContent = 
        selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : '');
    document.getElementById('context-chapter').textContent = currentChapter?.title || '未選択';
    
    document.getElementById('ai-assist-modal').style.display = 'flex';
    document.getElementById('ai-result').style.display = 'none';
}

// Handle AI assist option selection
async function handleAIAssistOption(event) {
    const action = event.currentTarget.dataset.action;
    const editor = document.getElementById('editor');
    const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    
    // Mark selected option as active
    document.querySelectorAll('.assist-option').forEach(opt => opt.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    try {
        // Show loading state
        document.getElementById('ai-result').style.display = 'block';
        document.getElementById('ai-suggestion').innerHTML = '<p>AIが考えています...</p>';
        
        // Prepare context
        const context = {
            chapterOutline: currentChapter?.summary || '',
            chapterTitle: currentChapter?.title || '',
            beforeText: editor.value.substring(Math.max(0, editor.selectionStart - 500), editor.selectionStart),
            afterText: editor.value.substring(editor.selectionEnd, Math.min(editor.value.length, editor.selectionEnd + 500))
        };
        
        // Call OpenAI through IPC
        const result = await window.api.invoke('openai:assistWriting', {
            action: action,
            text: selectedText || context.beforeText.slice(-200), // 選択テキストがない場合は前の200文字
            context: context
        });
        
        // Display result
        if (result.text) {
            document.getElementById('ai-suggestion').innerHTML = `<div class="ai-suggestion-content">${escapeHtml(result.text).replace(/\n/g, '<br>')}</div>`;
            window.aiSuggestion = result.text;
            
            // Set insert position based on action
            if (action === 'continue') {
                window.aiInsertPosition = editor.selectionEnd || editor.value.length;
            } else {
                window.aiInsertPosition = editor.selectionStart;
                window.aiReplaceLength = editor.selectionEnd - editor.selectionStart;
            }
        } else {
            throw new Error('No result from AI');
        }
        
    } catch (error) {
        console.error('AI assist failed:', error);
        let errorMessage = 'エラーが発生しました';
        
        if (error.message?.includes('not configured')) {
            errorMessage = 'OpenAI APIキーが設定されていません。設定画面でAPIキーを入力してください。';
        } else if (error.message?.includes('rate limit')) {
            errorMessage = 'APIのレート制限に達しました。しばらくお待ちください。';
        }
        
        document.getElementById('ai-suggestion').innerHTML = `<p class="error-message">${errorMessage}</p>`;
    }
}

// Accept AI suggestion
window.acceptAISuggestion = function() {
    if (window.aiSuggestion) {
        const editor = document.getElementById('editor');
        let before, after;
        
        if (window.aiReplaceLength > 0) {
            // Replace selected text
            before = editor.value.substring(0, window.aiInsertPosition);
            after = editor.value.substring(window.aiInsertPosition + window.aiReplaceLength);
        } else {
            // Insert at position
            before = editor.value.substring(0, window.aiInsertPosition);
            after = editor.value.substring(window.aiInsertPosition);
        }
        
        editor.value = before + window.aiSuggestion + after;
        editor.setSelectionRange(window.aiInsertPosition, window.aiInsertPosition + window.aiSuggestion.length);
        editor.focus();
        
        handleEditorInput({ target: editor });
        closeAIAssistModal();
    }
};

// Regenerate AI suggestion
window.regenerateAI = function() {
    // Re-trigger the last AI action
    const activeOption = document.querySelector('.assist-option.active');
    if (activeOption) {
        handleAIAssistOption({ currentTarget: activeOption });
    }
};

// Reject AI suggestion
window.rejectAISuggestion = function() {
    closeAIAssistModal();
};

// Close AI assist modal
window.closeAIAssistModal = function() {
    document.getElementById('ai-assist-modal').style.display = 'none';
    window.aiSuggestion = null;
    window.aiInsertPosition = null;
};

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
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Display chapter outline
function displayChapterOutline(chapter) {
    const container = document.getElementById('chapter-outline');
    
    if (chapter.summary) {
        container.innerHTML = `<p>${escapeHtml(chapter.summary)}</p>`;
    } else {
        container.innerHTML = '<p class="empty-state">概要が設定されていません</p>';
    }
    
    // Display scenes
    displayScenes(chapter.scenes || []);
}

// Display scenes
function displayScenes(scenes) {
    const container = document.getElementById('scenes-list');
    
    const sceneElements = scenes.map(scene => `
        <div class="scene-item" data-scene-id="${scene.id}">
            <div class="scene-title">${escapeHtml(scene.title)}</div>
            <div class="scene-info">${escapeHtml(scene.location || '')} • ${escapeHtml((scene.characters || []).join(', '))}</div>
        </div>
    `).join('');
    
    container.innerHTML = sceneElements + '<button class="add-scene-btn">+ シーンを追加</button>';
    
    // Re-attach event listener
    container.querySelector('.add-scene-btn').addEventListener('click', () => {
        document.getElementById('scene-modal').style.display = 'flex';
    });
}

// Scene management
window.saveScene = async function() {
    const title = document.getElementById('scene-title').value;
    const location = document.getElementById('scene-location').value;
    const characters = document.getElementById('scene-characters').value.split(',').map(c => c.trim());
    const summary = document.getElementById('scene-summary').value;
    
    if (!title) {
        window.api.showMessage('シーンタイトルを入力してください', 'warning');
        return;
    }
    
    try {
        const scene = {
            id: Date.now(),
            title,
            location,
            characters,
            summary
        };
        
        // Add scene to current chapter
        if (!currentChapter.scenes) {
            currentChapter.scenes = [];
        }
        currentChapter.scenes.push(scene);
        
        await window.api.invoke('plot:updateChapter', {
            plotId: currentPlot.id,
            chapterId: currentChapter.id,
            data: { scenes: currentChapter.scenes }
        });
        
        displayScenes(currentChapter.scenes);
        closeSceneModal();
        
        window.api.showMessage('シーンを追加しました', 'success');
    } catch (error) {
        console.error('Failed to save scene:', error);
        window.api.showMessage('シーンの保存に失敗しました', 'error');
    }
};

window.closeSceneModal = function() {
    document.getElementById('scene-modal').style.display = 'none';
    document.getElementById('scene-title').value = '';
    document.getElementById('scene-location').value = '';
    document.getElementById('scene-characters').value = '';
    document.getElementById('scene-summary').value = '';
};

// Knowledge search
async function handleKnowledgeSearch(event) {
    const query = event.target.value;
    if (!query || query.length < 2) {
        document.getElementById('knowledge-results').innerHTML = '';
        return;
    }
    
    try {
        const results = await window.api.invoke('knowledge:search', {
            projectId: currentProject.id,
            query: query,
            limit: 10
        });
        
        displayKnowledgeResults(results);
    } catch (error) {
        console.error('Knowledge search failed:', error);
    }
}

// Display knowledge search results
function displayKnowledgeResults(results) {
    const container = document.getElementById('knowledge-results');
    
    if (results.length === 0) {
        container.innerHTML = '<p class="empty-state">検索結果がありません</p>';
        return;
    }
    
    container.innerHTML = results.map(item => `
        <div class="knowledge-item" onclick="insertKnowledge('${escapeHtml(item.content)}')">
            <div class="knowledge-item-title">${escapeHtml(item.title)}</div>
            <div class="knowledge-item-preview">${escapeHtml(item.preview)}</div>
        </div>
    `).join('');
}

// Insert knowledge into editor
window.insertKnowledge = function(content) {
    const editor = document.getElementById('editor');
    const position = editor.selectionStart;
    const before = editor.value.substring(0, position);
    const after = editor.value.substring(position);
    
    editor.value = before + content + after;
    editor.setSelectionRange(position, position + content.length);
    editor.focus();
    
    handleEditorInput({ target: editor });
};

// Chapter notes
async function loadChapterNotes(chapter) {
    try {
        const notes = await window.api.invoke('chapter:getNotes', {
            plotId: currentPlot.id,
            chapterId: chapter.id
        });
        
        document.getElementById('chapter-notes').value = notes || '';
    } catch (error) {
        console.error('Failed to load chapter notes:', error);
    }
}

async function handleNotesChange(event) {
    if (!currentChapter) return;
    
    try {
        await window.api.invoke('chapter:saveNotes', {
            plotId: currentPlot.id,
            chapterId: currentChapter.id,
            notes: event.target.value
        });
    } catch (error) {
        console.error('Failed to save notes:', error);
    }
}

// Writing stats
async function loadWritingStats() {
    try {
        const stats = await window.api.invoke('stats:getWriting', {
            projectId: currentProject?.id
        });
        
        writingStats = stats;
        document.getElementById('total-chars').textContent = stats.totalChars.toLocaleString();
        document.getElementById('today-chars').textContent = stats.todayChars.toLocaleString();
    } catch (error) {
        console.error('Failed to load writing stats:', error);
    }
}

async function updateTotalStats() {
    if (!currentProject) return;
    
    try {
        const plots = await window.api.invoke('plot:list', { projectId: currentProject.id });
        let totalChars = 0;
        
        for (const plot of plots) {
            const chapters = plot.chapters || [];
            for (const chapter of chapters) {
                totalChars += chapter.wordCount || 0;
            }
        }
        
        document.getElementById('total-chars').textContent = totalChars.toLocaleString();
    } catch (error) {
        console.error('Failed to update total stats:', error);
    }
}

// Handle selection change
function handleSelectionChange() {
    updateCursorPosition();
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}