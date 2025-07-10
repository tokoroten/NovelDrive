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
let undoRedoManager = null;
let versionManager = null;
let knowledgeSuggestSystem = null;
let searchManager = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize undo/redo manager
    undoRedoManager = new UndoRedoManager(100);
    
    // Initialize version manager
    versionManager = new VersionManager();
    
    // Initialize version compare UI
    window.versionCompareUI = new VersionCompareUI(versionManager);
    window.versionCompareUI.init();
    
    // Initialize knowledge suggest system
    knowledgeSuggestSystem = new KnowledgeSuggestSystem();
    window.knowledgeSuggestSystem = knowledgeSuggestSystem;
    
    initializeEventListeners();
    
    // Initialize search manager (after event listeners to ensure editor is available)
    const editor = document.getElementById('editor');
    searchManager = new SearchManager(editor);
    searchManager.init(); // Load search history
    window.searchManager = searchManager;
    loadProjects();
    loadWritingStats();
    setupAutoSave();
    setupKeyboardShortcuts();
    setupVersionEventListeners();
    
    // Set keyboard shortcuts context
    if (window.keyboardShortcuts) {
        window.keyboardShortcuts.setContext('editor');
    }
    
    // Initialize AI assistant UI
    if (window.aiAssistant) {
        window.aiAssistant.initializeUI();
        // グローバルなaiThreadManagerを使用
        if (!window.aiThreadManager) {
            window.aiThreadManager = new AIThreadManager();
            window.aiThreadManager.loadThreads();
        }
    }
    
    // AI設定変更の監視
    setupAISettingsListeners();
});

// Initialize event listeners
function initializeEventListeners() {
    // Editor
    const editor = document.getElementById('editor');
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('selectionchange', handleSelectionChange);
    
    // Toolbar
    document.getElementById('save-content').addEventListener('click', saveContent);
    document.getElementById('undo').addEventListener('click', performUndo);
    document.getElementById('redo').addEventListener('click', performRedo);
    document.getElementById('version-history').addEventListener('click', openVersionHistory);
    document.getElementById('toggle-preview').addEventListener('click', togglePreview);
    document.getElementById('toggle-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('ai-evaluate').addEventListener('click', evaluateWithAI);
    document.getElementById('link-criteria').addEventListener('click', openLinkCriteriaSettings);
    document.getElementById('project-ai-settings').addEventListener('click', openProjectAISettings);
    
    // Chapter navigation
    document.getElementById('prev-chapter').addEventListener('click', navigateToPreviousChapter);
    document.getElementById('next-chapter').addEventListener('click', navigateToNextChapter);
    document.getElementById('chapter-jump').addEventListener('click', openChapterJumpModal);
    document.getElementById('goto-line').addEventListener('click', openGotoLineModal);
    
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
    
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Load projects for plot selection
async function loadProjects() {
    try {
        const apiInstance = window.api || window.mockAPI;
        const response = await apiInstance.invoke('project:getAll');
        const projects = window.mockAPI && response.data ? response.data : response;
        // Get current project from localStorage or URL params
        const projectId = localStorage.getItem('currentProjectId');
        if (projectId) {
            currentProject = projects.find(p => p.id === parseInt(projectId));
            if (currentProject) {
                await loadPlots(currentProject.id);
                
                // Initialize knowledge suggestions for this project
                if (knowledgeSuggestSystem) {
                    knowledgeSuggestSystem.init(currentProject.id);
                }
                
                // Apply project AI settings
                if (window.projectAISettings) {
                    window.projectAISettings.applyProjectSettings(currentProject.id);
                }
                
                // Fire project changed event
                window.dispatchEvent(new CustomEvent('project-changed', {
                    detail: { projectId: currentProject.id }
                }));
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
        // Disable navigation buttons when no chapters
        updateChapterNavigationButtons();
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
    
    // Update navigation buttons
    updateChapterNavigationButtons();
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
        
        const editor = document.getElementById('editor');
        editor.value = content || '';
        editorContent = content || '';
        isDirty = false;
        
        // Reset undo/redo history for new chapter
        undoRedoManager.clear();
        undoRedoManager.addState({
            content: content || '',
            cursorStart: 0,
            cursorEnd: 0
        });
        
        // Update undo/redo button states
        updateUndoRedoButtons();
        
        // Update active state
        document.querySelectorAll('.chapter-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.chapterId === String(chapterId));
        });
        
        // Load chapter outline and notes
        displayChapterOutline(chapter);
        loadChapterNotes(chapter);
        
        // Update stats
        updateCharacterCount();
        
        // Update chapter navigation buttons
        updateChapterNavigationButtons();
        
    } catch (error) {
        console.error('Failed to load chapter:', error);
        window.api.showMessage('章の読み込みに失敗しました', 'error');
    }
}

// Navigate to previous chapter
async function navigateToPreviousChapter() {
    if (!currentPlot || !currentChapter) return;
    
    const currentIndex = currentPlot.chapters.findIndex(ch => ch.id === currentChapter.id);
    if (currentIndex > 0) {
        await loadChapter(currentPlot.chapters[currentIndex - 1].id);
    }
}

// Navigate to next chapter
async function navigateToNextChapter() {
    if (!currentPlot || !currentChapter) return;
    
    const currentIndex = currentPlot.chapters.findIndex(ch => ch.id === currentChapter.id);
    if (currentIndex < currentPlot.chapters.length - 1) {
        await loadChapter(currentPlot.chapters[currentIndex + 1].id);
    }
}

// Update chapter navigation button states
function updateChapterNavigationButtons() {
    const prevBtn = document.getElementById('prev-chapter');
    const nextBtn = document.getElementById('next-chapter');
    
    if (!currentPlot || !currentChapter) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    
    const currentIndex = currentPlot.chapters.findIndex(ch => ch.id === currentChapter.id);
    
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= currentPlot.chapters.length - 1;
    
    // Update tooltips with chapter titles
    if (currentIndex > 0) {
        const prevChapter = currentPlot.chapters[currentIndex - 1];
        prevBtn.title = `前の章: ${prevChapter.title} (Ctrl+Left)`;
    } else {
        prevBtn.title = '前の章 (Ctrl+Left)';
    }
    
    if (currentIndex < currentPlot.chapters.length - 1) {
        const nextChapter = currentPlot.chapters[currentIndex + 1];
        nextBtn.title = `次の章: ${nextChapter.title} (Ctrl+Right)`;
    } else {
        nextBtn.title = '次の章 (Ctrl+Right)';
    }
}

// Handle editor input
function handleEditorInput(event) {
    const editor = event.target;
    editorContent = editor.value;
    isDirty = true;
    
    // Update character count
    updateCharacterCount();
    
    // Update cursor position
    updateCursorPosition();
    
    // Update last saved status
    document.getElementById('last-saved').textContent = '未保存';
    
    // Handle undo/redo history
    if (!undoRedoManager.isApplyingChange) {
        const cursorPosition = editor.selectionEnd;
        if (undoRedoManager.shouldCreateNewState(editorContent, cursorPosition)) {
            undoRedoManager.addState({
                content: editorContent,
                cursorStart: editor.selectionStart,
                cursorEnd: editor.selectionEnd
            });
            updateUndoRedoButtons();
        }
    }
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
        const savedAt = new Date();
        document.getElementById('last-saved').textContent = `保存済み ${savedAt.toLocaleTimeString('ja-JP')}`;
        
        // Save version
        versionManager.saveVersion(currentChapter.id, {
            content: content,
            title: currentChapter.title,
            wordCount: content.length,
            savedAt: savedAt.toISOString()
        });
        
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

// Setup version event listeners
function setupVersionEventListeners() {
    // Listen for version restore events
    window.addEventListener('version-restored', (event) => {
        const restored = event.detail;
        const editor = document.getElementById('editor');
        
        // Save current state as a new version before restoring
        if (editorContent && currentChapter) {
            versionManager.saveVersion(currentChapter.id, {
                content: editorContent,
                title: currentChapter.title,
                wordCount: editorContent.length,
                savedAt: new Date().toISOString()
            });
        }
        
        // Apply restored content
        editor.value = restored.content;
        editorContent = restored.content;
        isDirty = true;
        
        // Update UI
        updateCharacterCount();
        updateCursorPosition();
        document.getElementById('last-saved').textContent = `バージョン ${restored.restoredFrom.versionId} から復元`;
        
        // Save the restored content
        saveContent();
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveContent();
        }
        
        // Ctrl/Cmd + Z: Undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            performUndo();
        }
        
        // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            performRedo();
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
        
        // Ctrl/Cmd + Left Arrow: Previous chapter
        if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateToPreviousChapter();
        }
        
        // Ctrl/Cmd + Right Arrow: Next chapter
        if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
            e.preventDefault();
            navigateToNextChapter();
        }
        
        // Ctrl/Cmd + G: Chapter jump
        if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
            e.preventDefault();
            openChapterJumpModal();
        }
        
        // Ctrl/Cmd + Shift + G: Go to line
        if ((e.ctrlKey || e.metaKey) && e.key === 'G' && e.shiftKey) {
            e.preventDefault();
            openGotoLineModal();
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
async function openAIAssist() {
    const editor = document.getElementById('editor');
    const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    
    document.getElementById('selected-text-preview').textContent = 
        selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : '');
    document.getElementById('context-chapter').textContent = currentChapter?.title || '未選択';
    
    // Check OpenAI configuration
    try {
        const config = await window.api.invoke('openai:getConfig');
        if (!config.isConfigured) {
            // Show configuration notice
            document.getElementById('ai-suggestion').innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚙️</div>
                    <h4 style="margin-bottom: 1rem;">OpenAI API未設定</h4>
                    <p style="margin-bottom: 1.5rem;">AI支援機能を使用するには、OpenAI APIキーの設定が必要です。</p>
                    <button class="primary-btn" onclick="window.location.href='./settings.html'">
                        設定画面を開く
                    </button>
                </div>
            `;
            document.getElementById('ai-result').style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to check OpenAI config:', error);
    }
    
    document.getElementById('ai-assist-modal').style.display = 'flex';
}


// グローバルインスタンス
// Use the global aiThreadManager from ai-thread-manager.js
let aiThreadManager = window.aiThreadManager;

// Handle AI assist option selection - AIWritingAssistantを使用
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
        
        // AIWritingAssistantを使用してアクションを実行
        if (window.aiAssistant) {
            const result = await window.aiAssistant.executeAction(action, {
                selectedText: selectedText,
                cursorPosition: editor.selectionStart,
                fullText: editor.value,
                chapterTitle: currentChapter?.title || '',
                chapterSummary: currentChapter?.summary || '',
                projectId: currentProject?.id
            });
            
            // Display result
            if (result.text) {
                const agentInfo = window.aiAssistant.getCurrentAgentInfo();
                document.getElementById('ai-suggestion').innerHTML = `
                    <div class="ai-agent-info">
                        <span class="agent-name">${agentInfo.name}</span>
                        <span class="agent-style">[${agentInfo.style}]</span>
                        <button class="customize-agent-btn" onclick="window.aiAssistant.showPanel()">🎭 カスタマイズ</button>
                    </div>
                    <div class="ai-suggestion-content">${escapeHtml(result.text).replace(/\n/g, '<br>')}</div>
                `;
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
        } else {
            throw new Error('AI Assistant not initialized');
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

// アクションに応じてAIエージェントを選択
function getAIAgentForAction(action) {
    const agentMapping = {
        'continue': 'writer_sharp',
        'improve': 'writer_sharp', 
        'expand': 'writer_descriptive',
        'dialogue': 'writer_emotional',
        'scene': 'writer_descriptive',
        'brainstorm': 'writer_emotional'
    };
    
    return agentMapping[action] || 'writer_sharp';
}

// プロジェクトコンテキストを取得
async function getProjectContext() {
    if (!currentProject) return {};
    
    try {
        const knowledge = await window.api.invoke('knowledge:list', { projectId: currentProject.id });
        return {
            projectName: currentProject.name,
            genre: currentProject.parsedMetadata?.genre,
            themes: knowledge.knowledge?.filter(k => k.category === 'theme')?.map(k => k.title) || []
        };
    } catch (error) {
        return {};
    }
}

// キャラクターコンテキストを取得  
async function getCharacterContext() {
    if (!currentProject) return {};
    
    try {
        const characters = await window.api.invoke('knowledge:search', { 
            projectId: currentProject.id, 
            category: 'character' 
        });
        return {
            characters: characters.results?.map(c => ({
                name: c.title,
                description: c.content.substring(0, 200)
            })) || []
        };
    } catch (error) {
        return {};
    }
}

// Open AI Agent Customizer
window.openAgentCustomizer = function(agentId) {
    const customizerUrl = `./ai-customizer.html?agent=${agentId}`;
    const customizerWindow = window.open(customizerUrl, 'ai-customizer', 
        'width=1400,height=900,scrollbars=yes,resizable=yes');
    
    // Pass AI Thread Manager to customizer window
    customizerWindow.onload = function() {
        customizerWindow.aiThreadManager = aiThreadManager;
    };
};

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

// AI評価機能 - 評価パネルのトグルに変更
function evaluateWithAI() {
    // 新しい評価パネルを使用
    if (window.aiEvaluationPanel) {
        window.aiEvaluationPanel.toggle();
    }
}

// 評価基準設定を開く
function openLinkCriteriaSettings() {
    if (window.personalityCriteriaLink) {
        window.personalityCriteriaLink.showLinkSettings();
    }
}

// プロジェクトAI設定を開く
function openProjectAISettings() {
    if (window.projectAISettings && currentProject) {
        window.projectAISettings.showSettingsUI(currentProject.id);
    } else if (!currentProject) {
        alert('プロジェクトを選択してください。');
    }
}

// AIアシスタントパネルのトグル
function toggleAIAssistantPanel() {
    if (window.aiAssistant) {
        window.aiAssistant.togglePanel();
        
        // ボタンの状態を更新
        const btn = document.getElementById('ai-assistant-toggle');
        const panel = document.getElementById('ai-assistant-panel');
        if (btn && panel) {
            if (panel.classList.contains('visible')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }
}

// 削除: 評価結果表示関数は評価パネルに統合されました

// AI設定変更リスナーのセットアップ
function setupAISettingsListeners() {
    // AIアシスタントのスタイル変更
    if (window.aiAssistant) {
        const originalSaveSettings = window.aiAssistant.saveSettings;
        window.aiAssistant.saveSettings = function() {
            originalSaveSettings.call(this);
            window.dispatchEvent(new CustomEvent('ai-settings-changed', {
                detail: { type: 'writing-assistant' }
            }));
        };
    }
    
    // パーソナリティキャンバスの変更
    window.addEventListener('personality-updated', () => {
        window.dispatchEvent(new CustomEvent('ai-settings-changed', {
            detail: { type: 'personality' }
        }));
    });
    
    // 評価基準の変更
    window.addEventListener('criteria-updated', () => {
        window.dispatchEvent(new CustomEvent('ai-settings-changed', {
            detail: { type: 'criteria' }
        }));
    });
    
    // パーソナリティと評価基準のリンク変更
    window.addEventListener('personality-criteria-linked', () => {
        window.dispatchEvent(new CustomEvent('ai-settings-changed', {
            detail: { type: 'links' }
        }));
    });
}

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

// Undo operation
function performUndo() {
    if (!undoRedoManager.canUndo()) return;
    
    const editor = document.getElementById('editor');
    const previousState = undoRedoManager.undo();
    
    if (previousState) {
        undoRedoManager.setApplyingChange(true);
        editor.value = previousState.content;
        editor.setSelectionRange(previousState.cursorStart, previousState.cursorEnd);
        editorContent = previousState.content;
        isDirty = true;
        
        // Update UI
        updateCharacterCount();
        updateCursorPosition();
        updateUndoRedoButtons();
        document.getElementById('last-saved').textContent = '未保存';
        
        undoRedoManager.setApplyingChange(false);
    }
}

// Redo operation
function performRedo() {
    if (!undoRedoManager.canRedo()) return;
    
    const editor = document.getElementById('editor');
    const nextState = undoRedoManager.redo();
    
    if (nextState) {
        undoRedoManager.setApplyingChange(true);
        editor.value = nextState.content;
        editor.setSelectionRange(nextState.cursorStart, nextState.cursorEnd);
        editorContent = nextState.content;
        isDirty = true;
        
        // Update UI
        updateCharacterCount();
        updateCursorPosition();
        updateUndoRedoButtons();
        document.getElementById('last-saved').textContent = '未保存';
        
        undoRedoManager.setApplyingChange(false);
    }
}

// Update undo/redo button states
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    
    if (undoBtn) {
        undoBtn.disabled = !undoRedoManager.canUndo();
        undoBtn.style.opacity = undoRedoManager.canUndo() ? '1' : '0.5';
    }
    
    if (redoBtn) {
        redoBtn.disabled = !undoRedoManager.canRedo();
        redoBtn.style.opacity = undoRedoManager.canRedo() ? '1' : '0.5';
    }
}

// Open version history
function openVersionHistory() {
    if (!currentChapter) {
        alert('章を選択してください');
        return;
    }
    
    window.versionCompareUI.open(currentChapter.id);
}


// Chapter jump modal
function openChapterJumpModal() {
    if (!currentPlot || !currentPlot.chapters || currentPlot.chapters.length === 0) {
        window.api.showMessage('章がありません', 'warning');
        return;
    }
    
    const modal = document.getElementById('chapter-jump-modal');
    const listContainer = document.getElementById('chapter-jump-list');
    
    // Generate chapter list
    listContainer.innerHTML = currentPlot.chapters.map((chapter, index) => `
        <div class="chapter-jump-item ${chapter.id === currentChapter?.id ? 'current' : ''}" 
             onclick="jumpToChapter(${chapter.id})">
            <div class="chapter-jump-number">${index + 1}</div>
            <div class="chapter-jump-info">
                <div class="chapter-jump-title">${escapeHtml(chapter.title)}</div>
                <div class="chapter-jump-meta">${chapter.wordCount || 0}字 | ${chapter.status || '未設定'}</div>
            </div>
        </div>
    `).join('');
    
    modal.style.display = 'flex';
}

function closeChapterJumpModal() {
    document.getElementById('chapter-jump-modal').style.display = 'none';
}

async function jumpToChapter(chapterId) {
    closeChapterJumpModal();
    await loadChapter(chapterId);
}

// Global functions for modal onclick handlers
window.closeChapterJumpModal = closeChapterJumpModal;
window.jumpToChapter = jumpToChapter;

// Go to line modal
function openGotoLineModal() {
    const editor = document.getElementById('editor');
    const text = editor.value;
    const lines = text.split('\n');
    const totalLines = lines.length;
    
    // Calculate current line
    const selectionStart = editor.selectionStart;
    const textBeforeCursor = text.substring(0, selectionStart);
    const currentLine = textBeforeCursor.split('\n').length;
    
    // Update modal with current info
    document.getElementById('current-line-display').textContent = currentLine;
    document.getElementById('total-lines-display').textContent = totalLines;
    document.getElementById('goto-line-input').setAttribute('max', totalLines);
    document.getElementById('goto-line-input').value = currentLine;
    
    // Show modal
    const modal = document.getElementById('goto-line-modal');
    modal.style.display = 'flex';
    
    // Focus and select input
    const input = document.getElementById('goto-line-input');
    input.focus();
    input.select();
    
    // Handle Enter key in input
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performGotoLine();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeGotoLineModal();
        }
    });
}

function closeGotoLineModal() {
    document.getElementById('goto-line-modal').style.display = 'none';
}

function performGotoLine() {
    const input = document.getElementById('goto-line-input');
    const targetLine = parseInt(input.value);
    
    if (!targetLine || targetLine < 1) {
        showMessage('有効な行番号を入力してください', 'warning');
        return;
    }
    
    const editor = document.getElementById('editor');
    const text = editor.value;
    const lines = text.split('\n');
    const totalLines = lines.length;
    
    if (targetLine > totalLines) {
        showMessage(`行番号は1から${totalLines}の間で入力してください`, 'warning');
        return;
    }
    
    // Use SearchManager's jumpToLine method if available
    if (window.searchManager && window.searchManager.jumpToLine) {
        const success = window.searchManager.jumpToLine(targetLine);
        if (success) {
            closeGotoLineModal();
            showMessage(`${targetLine}行目に移動しました`, 'success');
        }
    } else {
        // Fallback implementation
        let position = 0;
        for (let i = 0; i < targetLine - 1; i++) {
            position += lines[i].length + 1; // +1 for newline character
        }
        
        // Move cursor to beginning of target line
        editor.setSelectionRange(position, position);
        editor.focus();
        
        // Scroll to make the line visible
        editor.scrollTop = Math.max(0, (targetLine - 5) * 20); // Approximate line height
        
        closeGotoLineModal();
        showMessage(`${targetLine}行目に移動しました`, 'success');
    }
}

// Global functions for modal onclick handlers
window.closeGotoLineModal = closeGotoLineModal;
window.performGotoLine = performGotoLine;

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    switch (page) {
        case 'agent-meeting':
            window.location.href = './agent-meeting.html';
            break;
        case 'projects':
            window.location.href = './projects.html';
            break;
        case 'writing-editor':
            // Already on this page
            break;
        case 'anything-box':
            window.location.href = './anything-box.html';
            break;
        case 'serendipity':
            window.location.href = './serendipity.html';
            break;
        case 'knowledge-graph':
            window.location.href = './knowledge-graph.html';
            break;
        case 'settings':
            window.location.href = './settings.html';
            break;
        default:
            console.log(`Navigation to ${page} not implemented`);
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}