// Global Keyboard Shortcuts System for NovelDrive

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.contexts = new Map(); // context-specific shortcuts
        this.currentContext = 'global';
        this.enabled = true;
        this.helpVisible = false;
        
        this.init();
    }

    /**
     * Initialize keyboard shortcuts system
     */
    init() {
        // Register global shortcuts
        this.registerGlobalShortcuts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Create help modal
        this.createHelpModal();
    }

    /**
     * Register global keyboard shortcuts
     */
    registerGlobalShortcuts() {
        // Global shortcuts (work everywhere)
        this.register('global', {
            'F1': {
                action: () => this.showHelp(),
                description: 'ヘルプを表示',
                category: 'システム'
            },
            'Ctrl+,': {
                action: () => this.openSettings(),
                description: '設定を開く',
                category: 'システム'
            },
            'Ctrl+Alt+M': {
                action: () => this.navigateToMeeting(),
                description: 'エージェント会議室に移動',
                category: 'ナビゲーション'
            },
            'Ctrl+Alt+P': {
                action: () => this.navigateToProjects(),
                description: 'プロジェクト一覧に移動',
                category: 'ナビゲーション'
            },
            'Ctrl+Alt+E': {
                action: () => this.navigateToEditor(),
                description: '執筆エディタに移動',
                category: 'ナビゲーション'
            },
            'Escape': {
                action: () => this.closeModals(),
                description: 'モーダルを閉じる',
                category: 'システム'
            }
        });

        // Editor-specific shortcuts
        this.register('editor', {
            'Ctrl+S': {
                action: () => this.saveContent(),
                description: '保存',
                category: '編集'
            },
            'Ctrl+Z': {
                action: () => this.undo(),
                description: '元に戻す',
                category: '編集'
            },
            'Ctrl+Y': {
                action: () => this.redo(),
                description: 'やり直し',
                category: '編集'
            },
            'Ctrl+Shift+Y': {
                action: () => this.redo(),
                description: 'やり直し',
                category: '編集'
            },
            'Ctrl+P': {
                action: () => this.togglePreview(),
                description: 'プレビュー切替',
                category: '表示'
            },
            'F11': {
                action: () => this.toggleFullscreen(),
                description: 'フルスクリーン切替',
                category: '表示'
            },
            'Ctrl+Space': {
                action: () => this.openAIAssist(),
                description: 'AI支援を開く',
                category: 'AI'
            },
            'Ctrl+Shift+H': {
                action: () => this.openVersionHistory(),
                description: 'バージョン履歴を表示',
                category: '編集'
            },
            'Ctrl+Shift+K': {
                action: () => this.toggleKnowledgeSuggest(),
                description: '知識提案の切替',
                category: 'AI'
            },
            'Ctrl+F': {
                action: () => this.openSearch(),
                description: '検索',
                category: '検索'
            },
            'Ctrl+G': {
                action: () => this.goToLine(),
                description: '行に移動',
                category: 'ナビゲーション'
            },
            'Ctrl+1': {
                action: () => this.selectChapter(1),
                description: '第1章を選択',
                category: 'ナビゲーション'
            },
            'Ctrl+2': {
                action: () => this.selectChapter(2),
                description: '第2章を選択',
                category: 'ナビゲーション'
            },
            'Ctrl+3': {
                action: () => this.selectChapter(3),
                description: '第3章を選択',
                category: 'ナビゲーション'
            },
            'Ctrl+ArrowLeft': {
                action: () => this.navigateToPreviousChapter(),
                description: '前の章に移動',
                category: 'ナビゲーション'
            },
            'Ctrl+ArrowRight': {
                action: () => this.navigateToNextChapter(),
                description: '次の章に移動',
                category: 'ナビゲーション'
            }
        });

        // Meeting room shortcuts
        this.register('meeting', {
            'Ctrl+Enter': {
                action: () => this.sendMessage(),
                description: 'メッセージ送信',
                category: '会議'
            },
            'Ctrl+Shift+C': {
                action: () => this.clearChat(),
                description: 'チャットをクリア',
                category: '会議'
            },
            'Ctrl+Shift+S': {
                action: () => this.startWorkflow(),
                description: 'ワークフローを開始',
                category: '会議'
            }
        });
    }

    /**
     * Register shortcuts for a specific context
     * @param {string} context 
     * @param {Object} shortcuts 
     */
    register(context, shortcuts) {
        if (!this.contexts.has(context)) {
            this.contexts.set(context, new Map());
        }
        
        const contextShortcuts = this.contexts.get(context);
        
        Object.entries(shortcuts).forEach(([key, config]) => {
            contextShortcuts.set(this.normalizeKey(key), config);
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            this.handleKeydown(e);
        });

        // Listen for context changes
        window.addEventListener('focus', () => {
            this.updateContext();
        });
    }

    /**
     * Handle keydown event
     * @param {KeyboardEvent} e 
     */
    handleKeydown(e) {
        const key = this.getKeyFromEvent(e);
        
        // Check context-specific shortcuts first
        const contextShortcuts = this.contexts.get(this.currentContext);
        if (contextShortcuts && contextShortcuts.has(key)) {
            const shortcut = contextShortcuts.get(key);
            e.preventDefault();
            e.stopPropagation();
            shortcut.action();
            return;
        }
        
        // Check global shortcuts
        const globalShortcuts = this.contexts.get('global');
        if (globalShortcuts && globalShortcuts.has(key)) {
            const shortcut = globalShortcuts.get(key);
            e.preventDefault();
            e.stopPropagation();
            shortcut.action();
            return;
        }
    }

    /**
     * Get normalized key string from event
     * @param {KeyboardEvent} e 
     * @returns {string}
     */
    getKeyFromEvent(e) {
        const parts = [];
        
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        
        // Handle special keys
        const specialKeys = {
            ' ': 'Space',
            'Enter': 'Enter',
            'Escape': 'Escape',
            'Tab': 'Tab',
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
            'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
            'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
        };
        
        const key = specialKeys[e.key] || e.key.toUpperCase();
        parts.push(key);
        
        return parts.join('+');
    }

    /**
     * Normalize key string
     * @param {string} key 
     * @returns {string}
     */
    normalizeKey(key) {
        return key.replace(/\s/g, '').split('+').map(part => {
            if (part.toLowerCase() === 'ctrl') return 'Ctrl';
            if (part.toLowerCase() === 'alt') return 'Alt';
            if (part.toLowerCase() === 'shift') return 'Shift';
            if (part.toLowerCase() === 'meta') return 'Meta';
            return part.toUpperCase();
        }).join('+');
    }

    /**
     * Update current context based on page
     */
    updateContext() {
        const path = window.location.pathname;
        
        if (path.includes('writing-editor')) {
            this.currentContext = 'editor';
        } else if (path.includes('agent-meeting')) {
            this.currentContext = 'meeting';
        } else {
            this.currentContext = 'global';
        }
    }

    /**
     * Set current context
     * @param {string} context 
     */
    setContext(context) {
        this.currentContext = context;
    }

    /**
     * Create help modal
     */
    createHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'keyboard-shortcuts-help';
        modal.className = 'modal keyboard-help-modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>キーボードショートカット</h3>
                    <button class="close-btn" onclick="keyboardShortcuts.hideHelp()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-container" id="shortcuts-container">
                        <!-- Shortcuts will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add styles
        this.injectStyles();
    }

    /**
     * Inject required styles
     */
    injectStyles() {
        if (document.getElementById('keyboard-shortcuts-styles')) return;

        const styles = `
            <style id="keyboard-shortcuts-styles">
                .keyboard-help-modal .modal-content {
                    max-width: 800px;
                    width: 90%;
                }

                .shortcuts-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 2rem;
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .shortcut-category {
                    background: var(--bg-secondary);
                    border-radius: 8px;
                    padding: 1rem;
                }

                .category-title {
                    font-weight: 600;
                    font-size: 1.1rem;
                    margin-bottom: 1rem;
                    color: var(--primary-color);
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 0.5rem;
                }

                .shortcut-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .shortcut-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem;
                    background: var(--bg-primary);
                    border-radius: 4px;
                    border: 1px solid var(--border-color);
                }

                .shortcut-key {
                    font-family: monospace;
                    background: var(--bg-tertiary);
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    border: 1px solid var(--border-color);
                }

                .shortcut-description {
                    flex: 1;
                    margin-left: 1rem;
                    font-size: 0.9rem;
                }

                .context-toggle {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .context-btn {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                }

                .context-btn.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .context-btn:hover:not(.active) {
                    background: var(--bg-tertiary);
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Show keyboard shortcuts help
     */
    showHelp() {
        this.helpVisible = true;
        this.updateContext();
        this.populateHelp();
        
        const modal = document.getElementById('keyboard-shortcuts-help');
        modal.style.display = 'flex';
    }

    /**
     * Hide keyboard shortcuts help
     */
    hideHelp() {
        this.helpVisible = false;
        const modal = document.getElementById('keyboard-shortcuts-help');
        modal.style.display = 'none';
    }

    /**
     * Populate help modal with shortcuts
     */
    populateHelp() {
        const container = document.getElementById('shortcuts-container');
        
        // Create context toggle
        const contextToggle = document.createElement('div');
        contextToggle.className = 'context-toggle';
        contextToggle.innerHTML = `
            <button class="context-btn ${this.currentContext === 'global' ? 'active' : ''}" onclick="keyboardShortcuts.showContextHelp('global')">
                グローバル
            </button>
            <button class="context-btn ${this.currentContext === 'editor' ? 'active' : ''}" onclick="keyboardShortcuts.showContextHelp('editor')">
                エディタ
            </button>
            <button class="context-btn ${this.currentContext === 'meeting' ? 'active' : ''}" onclick="keyboardShortcuts.showContextHelp('meeting')">
                会議室
            </button>
        `;
        
        container.innerHTML = '';
        container.appendChild(contextToggle);
        
        // Get shortcuts for current context and global
        const shortcuts = new Map();
        
        // Add global shortcuts
        const globalShortcuts = this.contexts.get('global');
        if (globalShortcuts) {
            globalShortcuts.forEach((config, key) => {
                shortcuts.set(key, config);
            });
        }
        
        // Add context-specific shortcuts
        if (this.currentContext !== 'global') {
            const contextShortcuts = this.contexts.get(this.currentContext);
            if (contextShortcuts) {
                contextShortcuts.forEach((config, key) => {
                    shortcuts.set(key, config);
                });
            }
        }
        
        // Group by category
        const categories = new Map();
        shortcuts.forEach((config, key) => {
            const category = config.category || 'その他';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push({ key, ...config });
        });
        
        // Create category sections
        categories.forEach((shortcutList, category) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'shortcut-category';
            
            categoryDiv.innerHTML = `
                <div class="category-title">${category}</div>
                <div class="shortcut-list">
                    ${shortcutList.map(shortcut => `
                        <div class="shortcut-item">
                            <span class="shortcut-key">${shortcut.key}</span>
                            <span class="shortcut-description">${shortcut.description}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            
            container.appendChild(categoryDiv);
        });
    }

    /**
     * Show help for specific context
     * @param {string} context 
     */
    showContextHelp(context) {
        this.currentContext = context;
        this.populateHelp();
    }

    /**
     * Enable/disable shortcuts
     * @param {boolean} enabled 
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    // Shortcut action methods
    openSettings() {
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = './settings.html';
        }
    }

    navigateToMeeting() {
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = './agent-meeting.html';
        }
    }

    navigateToProjects() {
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = './projects.html';
        }
    }

    navigateToEditor() {
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = './writing-editor.html';
        }
    }

    closeModals() {
        // Close any open modals
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });
    }

    // Editor-specific actions (will be overridden by editor if present)
    saveContent() {
        if (window.saveContent) window.saveContent();
    }

    undo() {
        if (window.performUndo) window.performUndo();
    }

    redo() {
        if (window.performRedo) window.performRedo();
    }

    togglePreview() {
        if (window.togglePreview) window.togglePreview();
    }

    toggleFullscreen() {
        if (window.toggleFullscreen) window.toggleFullscreen();
    }

    openAIAssist() {
        if (window.openAIAssist) window.openAIAssist();
    }

    openVersionHistory() {
        if (window.openVersionHistory) window.openVersionHistory();
    }

    toggleKnowledgeSuggest() {
        if (window.knowledgeSuggestSystem) {
            window.knowledgeSuggestSystem.toggle();
        }
    }

    openSearch() {
        // Implementation for search functionality
        console.log('Search functionality not implemented yet');
    }

    goToLine() {
        // Implementation for go to line functionality
        console.log('Go to line functionality not implemented yet');
    }

    selectChapter(number) {
        // Implementation for chapter selection
        console.log(`Select chapter ${number} not implemented yet`);
    }

    navigateToPreviousChapter() {
        console.log('Previous chapter navigation not implemented yet');
    }

    navigateToNextChapter() {
        console.log('Next chapter navigation not implemented yet');
    }

    // Meeting-specific actions
    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-message');
        if (sendButton) sendButton.click();
    }

    clearChat() {
        if (window.clearChat) window.clearChat();
    }

    startWorkflow() {
        if (window.startWorkflow) window.startWorkflow();
    }
}

// Create global instance
window.keyboardShortcuts = new KeyboardShortcuts();