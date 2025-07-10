// Knowledge Auto-Suggest System for Writing Editor

class KnowledgeSuggestSystem {
    constructor() {
        this.isEnabled = true;
        this.suggestions = new Map(); // cache for suggestions
        this.debounceTimer = null;
        this.currentProject = null;
        this.suggestionThreshold = 3; // minimum characters to trigger suggestions
        this.maxSuggestions = 5;
        this.contextWindow = 100; // characters to consider for context
    }

    /**
     * Initialize the knowledge suggestion system
     * @param {number} projectId - Current project ID
     */
    init(projectId) {
        this.currentProject = projectId;
        this.setupEventListeners();
        this.createSuggestionUI();
    }

    /**
     * Setup event listeners for the editor
     */
    setupEventListeners() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        // Listen to text input for auto-suggestions
        editor.addEventListener('input', (e) => this.handleTextInput(e));
        editor.addEventListener('selectionchange', () => this.handleSelectionChange());
        
        // Hide suggestions when editor loses focus
        editor.addEventListener('blur', () => this.hideSuggestions());
        
        // Handle keyboard navigation in suggestions
        editor.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    /**
     * Create the suggestion UI overlay
     */
    createSuggestionUI() {
        // Remove existing suggestion UI if present
        const existingUI = document.getElementById('knowledge-suggestions');
        if (existingUI) {
            existingUI.remove();
        }

        // Create suggestion container
        const suggestionContainer = document.createElement('div');
        suggestionContainer.id = 'knowledge-suggestions';
        suggestionContainer.className = 'knowledge-suggestions hidden';
        
        suggestionContainer.innerHTML = `
            <div class="suggestion-header">
                <span class="suggestion-title">関連知識</span>
                <button class="suggestion-close" onclick="knowledgeSuggestSystem.hideSuggestions()">✕</button>
            </div>
            <div class="suggestion-list" id="suggestion-list">
                <!-- Suggestions will be populated here -->
            </div>
            <div class="suggestion-footer">
                <small>Tab で挿入 • Esc で閉じる</small>
            </div>
        `;

        // Add to editor container
        const editorContainer = document.querySelector('.editor-container');
        editorContainer.appendChild(suggestionContainer);

        // Add styles
        this.injectStyles();
    }

    /**
     * Inject required CSS styles
     */
    injectStyles() {
        if (document.getElementById('knowledge-suggest-styles')) return;

        const styles = `
            <style id="knowledge-suggest-styles">
                .knowledge-suggestions {
                    position: absolute;
                    right: 20px;
                    top: 100px;
                    width: 300px;
                    max-height: 400px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                    overflow: hidden;
                    transition: all 0.2s ease;
                }

                .knowledge-suggestions.hidden {
                    opacity: 0;
                    transform: translateY(-10px);
                    pointer-events: none;
                }

                .suggestion-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border-color);
                }

                .suggestion-title {
                    font-weight: 500;
                    font-size: 0.9rem;
                }

                .suggestion-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-size: 1.1rem;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .suggestion-close:hover {
                    color: var(--text-primary);
                }

                .suggestion-list {
                    max-height: 280px;
                    overflow-y: auto;
                    padding: 0.5rem 0;
                }

                .suggestion-item {
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                    transition: background 0.15s ease;
                }

                .suggestion-item:hover,
                .suggestion-item.selected {
                    background: var(--bg-secondary);
                }

                .suggestion-item:last-child {
                    border-bottom: none;
                }

                .suggestion-item-title {
                    font-weight: 500;
                    font-size: 0.9rem;
                    margin-bottom: 0.25rem;
                    color: var(--text-primary);
                }

                .suggestion-item-content {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                .suggestion-item-tags {
                    margin-top: 0.5rem;
                    display: flex;
                    gap: 0.25rem;
                    flex-wrap: wrap;
                }

                .suggestion-tag {
                    background: var(--primary-light);
                    color: var(--primary);
                    padding: 0.125rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }

                .suggestion-footer {
                    padding: 0.5rem 1rem;
                    background: var(--bg-tertiary);
                    border-top: 1px solid var(--border-color);
                    text-align: center;
                    color: var(--text-secondary);
                }

                .suggestion-loading {
                    padding: 1rem;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }

                .suggestion-empty {
                    padding: 1rem;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }

                .auto-suggest-indicator {
                    position: absolute;
                    right: 10px;
                    top: 10px;
                    width: 8px;
                    height: 8px;
                    background: var(--primary);
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Handle text input in the editor
     * @param {Event} event 
     */
    handleTextInput(event) {
        if (!this.isEnabled || !this.currentProject) return;

        // Clear previous debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce the suggestion generation
        this.debounceTimer = setTimeout(() => {
            this.generateSuggestions();
        }, 500); // Wait 500ms after user stops typing
    }

    /**
     * Handle selection change in the editor
     */
    handleSelectionChange() {
        // Update suggestions based on cursor position if visible
        if (!document.getElementById('knowledge-suggestions').classList.contains('hidden')) {
            this.generateSuggestions();
        }
    }

    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} event 
     */
    handleKeyDown(event) {
        const suggestionsContainer = document.getElementById('knowledge-suggestions');
        if (suggestionsContainer.classList.contains('hidden')) return;

        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        const selectedItem = suggestionsContainer.querySelector('.suggestion-item.selected');
        let selectedIndex = selectedItem ? Array.from(items).indexOf(selectedItem) : -1;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                this.updateSelection(items, selectedIndex);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.updateSelection(items, selectedIndex);
                break;
                
            case 'Tab':
            case 'Enter':
                event.preventDefault();
                if (selectedItem) {
                    this.insertSuggestion(selectedItem);
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                this.hideSuggestions();
                break;
        }
    }

    /**
     * Update selection highlight
     * @param {NodeList} items 
     * @param {number} selectedIndex 
     */
    updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }

    /**
     * Generate knowledge suggestions based on current context
     */
    async generateSuggestions() {
        const editor = document.getElementById('editor');
        const cursorPosition = editor.selectionStart;
        const text = editor.value;
        
        // Get context around cursor
        const startPos = Math.max(0, cursorPosition - this.contextWindow);
        const endPos = Math.min(text.length, cursorPosition + this.contextWindow);
        const context = text.substring(startPos, endPos);
        
        // Extract keywords from context
        const keywords = this.extractKeywords(context);
        
        if (keywords.length === 0) {
            this.hideSuggestions();
            return;
        }

        try {
            // Show loading state
            this.showLoading();
            
            // Search for relevant knowledge
            const suggestions = await this.searchKnowledge(keywords);
            
            if (suggestions.length > 0) {
                this.displaySuggestions(suggestions);
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('Failed to generate knowledge suggestions:', error);
            this.hideSuggestions();
        }
    }

    /**
     * Extract keywords from text context
     * @param {string} text 
     * @returns {Array<string>}
     */
    extractKeywords(text) {
        // Remove punctuation and split into words
        const words = text
            .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length >= this.suggestionThreshold);

        // Filter out common words (stop words)
        const stopWords = new Set([
            'の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'から', 'まで',
            'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
        ]);

        const keywords = words.filter(word => !stopWords.has(word.toLowerCase()));
        
        // Return unique keywords, limited to reasonable number
        return [...new Set(keywords)].slice(0, 10);
    }

    /**
     * Search for knowledge items related to keywords
     * @param {Array<string>} keywords 
     * @returns {Promise<Array>}
     */
    async searchKnowledge(keywords) {
        try {
            const searchPromises = keywords.map(keyword =>
                window.api.invoke('knowledge:search', {
                    projectId: this.currentProject,
                    query: keyword,
                    limit: 3
                })
            );

            const results = await Promise.all(searchPromises);
            
            // Flatten and deduplicate results
            const allSuggestions = results.flat();
            const uniqueSuggestions = [];
            const seenIds = new Set();

            for (const suggestion of allSuggestions) {
                if (!seenIds.has(suggestion.id)) {
                    seenIds.add(suggestion.id);
                    uniqueSuggestions.push(suggestion);
                }
            }

            // Sort by relevance (can be improved with scoring)
            return uniqueSuggestions
                .sort((a, b) => b.relevance || 0 - a.relevance || 0)
                .slice(0, this.maxSuggestions);
        } catch (error) {
            console.error('Knowledge search failed:', error);
            return [];
        }
    }

    /**
     * Show loading state in suggestions
     */
    showLoading() {
        const suggestionList = document.getElementById('suggestion-list');
        suggestionList.innerHTML = '<div class="suggestion-loading">関連知識を検索中...</div>';
        this.showSuggestions();
    }

    /**
     * Display suggestions in the UI
     * @param {Array} suggestions 
     */
    displaySuggestions(suggestions) {
        const suggestionList = document.getElementById('suggestion-list');
        
        if (suggestions.length === 0) {
            suggestionList.innerHTML = '<div class="suggestion-empty">関連する知識が見つかりませんでした</div>';
            return;
        }

        suggestionList.innerHTML = suggestions.map((item, index) => `
            <div class="suggestion-item ${index === 0 ? 'selected' : ''}" 
                 data-knowledge-id="${item.id}"
                 onclick="knowledgeSuggestSystem.insertSuggestion(this)">
                <div class="suggestion-item-title">${this.escapeHtml(item.title)}</div>
                <div class="suggestion-item-content">${this.escapeHtml(item.content || item.preview || '')}</div>
                ${item.tags && item.tags.length > 0 ? `
                    <div class="suggestion-item-tags">
                        ${item.tags.slice(0, 3).map(tag => 
                            `<span class="suggestion-tag">${this.escapeHtml(tag)}</span>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        this.showSuggestions();
    }

    /**
     * Show the suggestions container
     */
    showSuggestions() {
        const container = document.getElementById('knowledge-suggestions');
        container.classList.remove('hidden');
        
        // Add indicator to editor
        this.showAutoSuggestIndicator();
    }

    /**
     * Hide the suggestions container
     */
    hideSuggestions() {
        const container = document.getElementById('knowledge-suggestions');
        container.classList.add('hidden');
        
        // Remove indicator
        this.hideAutoSuggestIndicator();
    }

    /**
     * Show auto-suggest indicator
     */
    showAutoSuggestIndicator() {
        const editor = document.getElementById('editor');
        let indicator = editor.parentElement.querySelector('.auto-suggest-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'auto-suggest-indicator';
            editor.parentElement.style.position = 'relative';
            editor.parentElement.appendChild(indicator);
        }
    }

    /**
     * Hide auto-suggest indicator
     */
    hideAutoSuggestIndicator() {
        const indicator = document.querySelector('.auto-suggest-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Insert selected suggestion into editor
     * @param {HTMLElement} suggestionElement 
     */
    insertSuggestion(suggestionElement) {
        const knowledgeId = suggestionElement.dataset.knowledgeId;
        const title = suggestionElement.querySelector('.suggestion-item-title').textContent;
        const content = suggestionElement.querySelector('.suggestion-item-content').textContent;
        
        const editor = document.getElementById('editor');
        const cursorPosition = editor.selectionStart;
        const currentText = editor.value;
        
        // Insert reference or content at cursor position
        const insertText = `[${title}]`; // Simple reference format
        
        const beforeText = currentText.substring(0, cursorPosition);
        const afterText = currentText.substring(cursorPosition);
        
        editor.value = beforeText + insertText + afterText;
        editor.setSelectionRange(
            cursorPosition + insertText.length,
            cursorPosition + insertText.length
        );
        
        // Focus back to editor
        editor.focus();
        
        // Trigger input event to update editor state
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Hide suggestions
        this.hideSuggestions();
        
        // Log insertion for analytics
        this.logSuggestionUsage(knowledgeId, 'inserted');
    }

    /**
     * Log suggestion usage for analytics
     * @param {string} knowledgeId 
     * @param {string} action 
     */
    logSuggestionUsage(knowledgeId, action) {
        // This could be sent to analytics service
        console.log(`Knowledge suggestion ${action}: ${knowledgeId}`);
    }

    /**
     * Toggle auto-suggestions on/off
     */
    toggle() {
        this.isEnabled = !this.isEnabled;
        
        if (!this.isEnabled) {
            this.hideSuggestions();
        }
        
        // Update UI indicator
        const toggleButton = document.getElementById('auto-suggest-toggle');
        if (toggleButton) {
            toggleButton.classList.toggle('active', this.isEnabled);
            toggleButton.title = this.isEnabled ? '自動提案を無効にする' : '自動提案を有効にする';
        }
    }

    /**
     * Escape HTML for safe display
     * @param {string} text 
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clean up event listeners and UI
     */
    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        const container = document.getElementById('knowledge-suggestions');
        if (container) {
            container.remove();
        }
        
        this.hideAutoSuggestIndicator();
    }
}

// Create global instance
window.knowledgeSuggestSystem = null;