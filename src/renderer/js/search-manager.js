// Search Manager for Writing Editor
class SearchManager {
    constructor(textareaElement) {
        this.textarea = textareaElement;
        this.searchModal = null;
        this.searchInput = null;
        this.replaceInput = null;
        this.currentMatches = [];
        this.currentIndex = -1;
        this.isReplaceMode = false;
        this.highlightOverlay = null;
        this.lastSearchTerm = '';
        this.searchHistory = [];
        this.maxHistory = 20;
        
        this.initializeElements();
        this.bindEvents();
        this.createHighlightOverlay();
    }
    
    initializeElements() {
        this.searchModal = document.getElementById('search-modal');
        this.searchInput = document.getElementById('search-input');
        this.replaceInput = document.getElementById('replace-input');
        this.searchCountSpan = document.getElementById('search-count');
        this.replaceContainer = document.querySelector('.search-replace-container');
        this.toggleReplaceBtn = document.getElementById('toggle-replace');
        
        // Options
        this.caseSensitive = document.getElementById('case-sensitive');
        this.wholeWord = document.getElementById('whole-word');
        this.regexSearch = document.getElementById('regex-search');
    }
    
    bindEvents() {
        // Search button in toolbar
        document.getElementById('search-btn').addEventListener('click', () => {
            this.showSearchModal();
        });
        
        // Search input events
        this.searchInput.addEventListener('input', () => {
            this.performSearch();
        });
        
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addToHistory(this.searchInput.value);
                if (e.shiftKey) {
                    this.findPrevious();
                } else {
                    this.findNext();
                }
            } else if (e.key === 'Escape') {
                this.hideSearchModal();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });
        
        // Navigation buttons
        document.getElementById('search-prev').addEventListener('click', () => {
            this.findPrevious();
        });
        
        document.getElementById('search-next').addEventListener('click', () => {
            this.findNext();
        });
        
        // Close button
        document.getElementById('search-close').addEventListener('click', () => {
            this.hideSearchModal();
        });
        
        // Options checkboxes
        [this.caseSensitive, this.wholeWord, this.regexSearch].forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.performSearch();
            });
        });
        
        // Toggle replace mode
        this.toggleReplaceBtn.addEventListener('click', () => {
            this.toggleReplaceMode();
        });
        
        // Replace buttons
        document.getElementById('replace-current').addEventListener('click', () => {
            this.replaceCurrent();
        });
        
        document.getElementById('replace-all').addEventListener('click', () => {
            this.replaceAllWithConfirmation();
        });
        
        // Replace input events
        this.replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.replaceCurrent();
            } else if (e.key === 'Escape') {
                this.hideSearchModal();
            }
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.showSearchModal();
            } else if (e.key === 'Escape' && this.isVisible()) {
                this.hideSearchModal();
            }
        });
        
        // Hide search when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isVisible() && !this.searchModal.contains(e.target) && 
                e.target.id !== 'search-btn') {
                this.hideSearchModal();
            }
        });
    }
    
    showSearchModal() {
        this.searchModal.style.display = 'block';
        this.searchInput.focus();
        
        // If there's selected text, use it as search term
        const selectedText = this.getSelectedText();
        if (selectedText) {
            this.searchInput.value = selectedText;
            this.performSearch();
        }
    }
    
    hideSearchModal() {
        this.searchModal.style.display = 'none';
        this.clearHighlights();
        this.textarea.focus();
    }
    
    isVisible() {
        return this.searchModal.style.display === 'block';
    }
    
    toggleReplaceMode() {
        this.isReplaceMode = !this.isReplaceMode;
        this.replaceContainer.style.display = this.isReplaceMode ? 'block' : 'none';
        this.toggleReplaceBtn.classList.toggle('active', this.isReplaceMode);
        
        if (this.isReplaceMode) {
            this.replaceInput.focus();
        } else {
            this.searchInput.focus();
        }
    }
    
    getSelectedText() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        return this.textarea.value.substring(start, end);
    }
    
    performSearch() {
        const searchTerm = this.searchInput.value;
        this.clearHighlights();
        this.currentMatches = [];
        this.currentIndex = -1;
        
        if (!searchTerm) {
            this.updateSearchCount();
            return;
        }
        
        try {
            const matches = this.findMatches(searchTerm);
            this.currentMatches = matches;
            this.highlightMatches();
            this.updateSearchCount();
            
            if (matches.length > 0) {
                this.currentIndex = 0;
                this.jumpToMatch(0);
            }
        } catch (error) {
            // Handle regex errors
            console.error('Search error:', error);
            this.searchCountSpan.textContent = 'エラー';
        }
    }
    
    findMatches(searchTerm) {
        const text = this.textarea.value;
        const matches = [];
        
        let pattern;
        if (this.regexSearch.checked) {
            const flags = this.caseSensitive.checked ? 'g' : 'gi';
            pattern = new RegExp(searchTerm, flags);
        } else {
            let escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            if (this.wholeWord.checked) {
                escapedTerm = `\\b${escapedTerm}\\b`;
            }
            
            const flags = this.caseSensitive.checked ? 'g' : 'gi';
            pattern = new RegExp(escapedTerm, flags);
        }
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
            });
            
            // Prevent infinite loop with zero-length matches
            if (match[0].length === 0) {
                pattern.lastIndex++;
            }
        }
        
        return matches;
    }
    
    createHighlightOverlay() {
        // Create a div to overlay highlights on the textarea
        const container = this.textarea.parentElement;
        this.highlightOverlay = document.createElement('div');
        this.highlightOverlay.className = 'search-highlight-overlay';
        this.highlightOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            padding: inherit;
            border: inherit;
            margin: inherit;
            overflow: hidden;
            z-index: 1;
        `;
        
        // Make sure the container is positioned
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        
        container.appendChild(this.highlightOverlay);
        
        // Sync scroll position
        this.textarea.addEventListener('scroll', () => {
            this.highlightOverlay.scrollTop = this.textarea.scrollTop;
            this.highlightOverlay.scrollLeft = this.textarea.scrollLeft;
        });
    }
    
    highlightMatches() {
        if (!this.highlightOverlay || this.currentMatches.length === 0) {
            this.clearHighlights();
            return;
        }
        
        const text = this.textarea.value;
        let highlightedText = '';
        let lastIndex = 0;
        
        this.currentMatches.forEach((match, index) => {
            // Add text before the match
            highlightedText += this.escapeHtml(text.substring(lastIndex, match.start));
            
            // Add highlighted match
            const isActive = index === this.currentIndex;
            const className = isActive ? 'search-highlight-active' : 'search-highlight';
            highlightedText += `<span class="${className}">${this.escapeHtml(match.text)}</span>`;
            
            lastIndex = match.end;
        });
        
        // Add remaining text
        highlightedText += this.escapeHtml(text.substring(lastIndex));
        
        this.highlightOverlay.innerHTML = highlightedText;
        
        // Sync scroll position
        this.highlightOverlay.scrollTop = this.textarea.scrollTop;
        this.highlightOverlay.scrollLeft = this.textarea.scrollLeft;
    }
    
    clearHighlights() {
        if (this.highlightOverlay) {
            this.highlightOverlay.innerHTML = '';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateSearchCount() {
        const count = this.currentMatches.length;
        const current = this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
        
        if (count === 0) {
            this.searchCountSpan.textContent = '0件の結果';
        } else {
            this.searchCountSpan.textContent = `${current}/${count}件`;
        }
    }
    
    findNext() {
        if (this.currentMatches.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.currentMatches.length;
        this.jumpToMatch(this.currentIndex);
        this.updateSearchCount();
    }
    
    findPrevious() {
        if (this.currentMatches.length === 0) return;
        
        this.currentIndex = this.currentIndex <= 0 
            ? this.currentMatches.length - 1 
            : this.currentIndex - 1;
        this.jumpToMatch(this.currentIndex);
        this.updateSearchCount();
    }
    
    jumpToMatch(index) {
        if (index < 0 || index >= this.currentMatches.length) return;
        
        const match = this.currentMatches[index];
        this.textarea.focus();
        this.textarea.setSelectionRange(match.start, match.end);
        this.textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    replaceCurrent() {
        if (this.currentIndex < 0 || this.currentIndex >= this.currentMatches.length) {
            return;
        }
        
        const match = this.currentMatches[this.currentIndex];
        const replaceText = this.replaceInput.value;
        
        // Replace the text
        const before = this.textarea.value.substring(0, match.start);
        const after = this.textarea.value.substring(match.end);
        this.textarea.value = before + replaceText + after;
        
        // Update cursor position
        const newCursorPos = match.start + replaceText.length;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger change event for undo/redo system
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Refresh search results
        this.performSearch();
    }
    
    replaceAll() {
        if (this.currentMatches.length === 0) return;
        
        const replaceText = this.replaceInput.value;
        let text = this.textarea.value;
        let offset = 0;
        
        // Replace all matches from end to start to maintain indices
        for (let i = this.currentMatches.length - 1; i >= 0; i--) {
            const match = this.currentMatches[i];
            const before = text.substring(0, match.start);
            const after = text.substring(match.end);
            text = before + replaceText + after;
        }
        
        this.textarea.value = text;
        
        // Trigger change event for undo/redo system
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Clear search results
        this.clearHighlights();
        this.currentMatches = [];
        this.currentIndex = -1;
        this.updateSearchCount();
        
        this.textarea.focus();
    }
    
    // Search history management
    addToHistory(searchTerm) {
        if (!searchTerm || searchTerm === this.lastSearchTerm) return;
        
        // Remove if already exists
        const existingIndex = this.searchHistory.indexOf(searchTerm);
        if (existingIndex !== -1) {
            this.searchHistory.splice(existingIndex, 1);
        }
        
        // Add to beginning
        this.searchHistory.unshift(searchTerm);
        
        // Limit size
        if (this.searchHistory.length > this.maxHistory) {
            this.searchHistory.pop();
        }
        
        this.lastSearchTerm = searchTerm;
        this.saveSearchHistory();
    }
    
    navigateHistory(direction) {
        if (this.searchHistory.length === 0) return;
        
        const currentValue = this.searchInput.value;
        let currentIndex = this.searchHistory.indexOf(currentValue);
        
        if (direction > 0) {
            // Down arrow - go to next in history
            currentIndex = Math.min(currentIndex + 1, this.searchHistory.length - 1);
        } else {
            // Up arrow - go to previous in history
            currentIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        }
        
        if (currentIndex >= 0 && currentIndex < this.searchHistory.length) {
            this.searchInput.value = this.searchHistory[currentIndex];
            this.performSearch();
        }
    }
    
    saveSearchHistory() {
        try {
            localStorage.setItem('novel-drive-search-history', JSON.stringify(this.searchHistory));
        } catch (e) {
            console.warn('Failed to save search history:', e);
        }
    }
    
    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('novel-drive-search-history');
            if (saved) {
                this.searchHistory = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load search history:', e);
            this.searchHistory = [];
        }
    }
    
    // Enhanced text navigation
    jumpToLine(lineNumber) {
        const lines = this.textarea.value.split('\n');
        if (lineNumber < 1 || lineNumber > lines.length) return false;
        
        let position = 0;
        for (let i = 0; i < lineNumber - 1; i++) {
            position += lines[i].length + 1; // +1 for newline
        }
        
        this.textarea.focus();
        this.textarea.setSelectionRange(position, position);
        this.textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }
    
    // Get current line and column
    getCurrentPosition() {
        const text = this.textarea.value;
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        
        return {
            line: lines.length,
            column: lines[lines.length - 1].length + 1,
            totalLines: text.split('\n').length
        };
    }
    
    // Find and replace with confirmation
    replaceWithConfirmation() {
        if (this.currentIndex < 0 || this.currentIndex >= this.currentMatches.length) {
            return;
        }
        
        const match = this.currentMatches[this.currentIndex];
        const replaceText = this.replaceInput.value;
        
        // Show confirmation dialog
        const confirmed = confirm(`"${match.text}" を "${replaceText}" に置換しますか？`);
        if (confirmed) {
            this.replaceCurrent();
        }
    }
    
    // Count occurrences before replacement
    getReplacementPreview() {
        const count = this.currentMatches.length;
        const replaceText = this.replaceInput.value;
        const searchTerm = this.searchInput.value;
        
        if (count === 0) {
            return `置換対象が見つかりません`;
        }
        
        return `"${searchTerm}" を "${replaceText}" に ${count}箇所置換します`;
    }
    
    // Batch replace with confirmation
    replaceAllWithConfirmation() {
        const preview = this.getReplacementPreview();
        const confirmed = confirm(`${preview}\n\nよろしいですか？`);
        
        if (confirmed) {
            const replaceCount = this.currentMatches.length;
            this.replaceAll();
            this.showNotification(`${replaceCount}箇所を置換しました`);
        }
    }
    
    showNotification(message) {
        // Simple notification - could be enhanced with a toast system
        const notification = document.createElement('div');
        notification.className = 'search-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: fadeInOut 3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    // Initialize with saved history
    init() {
        this.loadSearchHistory();
        this.setupPositionTracking();
        this.setupGlobalShortcuts();
    }
    
    // Setup real-time position tracking
    setupPositionTracking() {
        // Update position info when search modal is shown
        const updatePosition = () => {
            if (this.isVisible()) {
                const position = this.getCurrentPosition();
                const info = `現在: ${position.line}行 ${position.column}列 (全${position.totalLines}行)`;
                
                // Update search info if element exists
                const positionInfo = document.getElementById('position-info');
                if (positionInfo) {
                    positionInfo.textContent = info;
                } else {
                    // Create position info element
                    const posInfo = document.createElement('div');
                    posInfo.id = 'position-info';
                    posInfo.className = 'position-info';
                    posInfo.textContent = info;
                    posInfo.style.cssText = `
                        font-size: 11px;
                        color: #888;
                        margin-top: 5px;
                        text-align: right;
                    `;
                    const searchInfo = document.querySelector('.search-info');
                    if (searchInfo) {
                        searchInfo.appendChild(posInfo);
                    }
                }
            }
        };
        
        // Update position on cursor movement
        this.textarea.addEventListener('selectionchange', updatePosition);
        this.textarea.addEventListener('keyup', updatePosition);
        this.textarea.addEventListener('click', updatePosition);
    }
    
    // Quick search without modal (for Ctrl+F3, F3)
    quickFindNext() {
        if (this.lastSearchTerm) {
            this.searchInput.value = this.lastSearchTerm;
            this.performSearch();
            this.findNext();
        }
    }
    
    quickFindPrevious() {
        if (this.lastSearchTerm) {
            this.searchInput.value = this.lastSearchTerm;
            this.performSearch();
            this.findPrevious();
        }
    }
    
    // Search for selected text
    searchSelection() {
        const selectedText = this.getSelectedText();
        if (selectedText) {
            this.showSearchModal();
            this.searchInput.value = selectedText;
            this.performSearch();
        }
    }
    
    // Enhanced keyboard shortcuts
    setupGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F3 - Find next
            if (e.key === 'F3' && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                this.quickFindNext();
            }
            // Shift+F3 - Find previous
            else if (e.key === 'F3' && e.shiftKey) {
                e.preventDefault();
                this.quickFindPrevious();
            }
            // Ctrl+F3 - Search selection
            else if (e.key === 'F3' && e.ctrlKey) {
                e.preventDefault();
                this.searchSelection();
            }
            // Ctrl+H - Replace
            else if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                this.showSearchModal();
                this.toggleReplaceMode();
            }
        });
    }
}

// Add CSS for search functionality
const searchStyles = document.createElement('style');
searchStyles.textContent = `
    .search-highlight {
        background-color: #ffeb3b;
        border-radius: 2px;
    }
    
    .search-highlight-active {
        background-color: #ff9800;
        border-radius: 2px;
        box-shadow: 0 0 3px rgba(255, 152, 0, 0.8);
    }
    
    .search-modal {
        position: fixed;
        top: 10px;
        right: 20px;
        z-index: 1000;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 400px;
    }
    
    .search-modal-content {
        padding: 15px;
    }
    
    .search-header {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .search-input-container {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .search-input, .replace-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    
    .search-nav-btn, .search-close-btn, .replace-btn {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 12px;
    }
    
    .search-nav-btn:hover, .search-close-btn:hover, .replace-btn:hover {
        background: #f5f5f5;
    }
    
    .search-options {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
    }
    
    .search-option {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        cursor: pointer;
    }
    
    .search-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        font-size: 12px;
        color: #666;
    }
    
    .toggle-replace-btn {
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 12px;
    }
    
    .toggle-replace-btn:hover {
        background: #f5f5f5;
    }
    
    .toggle-replace-btn.active {
        background: #2196F3;
        color: white;
    }
    
    .replace-input-container {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 10px;
    }
    
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
    }
`;

document.head.appendChild(searchStyles);

// Export for use in writing-editor.js
window.SearchManager = SearchManager;