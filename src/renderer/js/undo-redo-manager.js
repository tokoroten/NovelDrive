// Undo/Redo Manager for the Writing Editor

class UndoRedoManager {
    constructor(maxHistorySize = 100) {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = maxHistorySize;
        this.isApplyingChange = false;
        this.lastContent = '';
        this.lastCursorPosition = 0;
    }

    /**
     * Add a new state to the history
     * @param {Object} state - { content: string, cursorStart: number, cursorEnd: number }
     */
    addState(state) {
        if (this.isApplyingChange) return;

        // Remove any states after the current index (when user makes change after undo)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Add the new state
        this.history.push({
            content: state.content,
            cursorStart: state.cursorStart,
            cursorEnd: state.cursorEnd,
            timestamp: Date.now()
        });

        // Maintain max history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }

        this.lastContent = state.content;
        this.lastCursorPosition = state.cursorEnd;
    }

    /**
     * Check if we can undo
     * @returns {boolean}
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Check if we can redo
     * @returns {boolean}
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Perform undo operation
     * @returns {Object|null} Previous state or null if cannot undo
     */
    undo() {
        if (!this.canUndo()) return null;

        this.currentIndex--;
        return this.history[this.currentIndex];
    }

    /**
     * Perform redo operation
     * @returns {Object|null} Next state or null if cannot redo
     */
    redo() {
        if (!this.canRedo()) return null;

        this.currentIndex++;
        return this.history[this.currentIndex];
    }

    /**
     * Set flag to prevent adding states while applying changes
     * @param {boolean} isApplying
     */
    setApplyingChange(isApplying) {
        this.isApplyingChange = isApplying;
    }

    /**
     * Clear all history
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.lastContent = '';
        this.lastCursorPosition = 0;
    }

    /**
     * Get current state
     * @returns {Object|null}
     */
    getCurrentState() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
            return this.history[this.currentIndex];
        }
        return null;
    }

    /**
     * Check if content has changed significantly enough to warrant a new history entry
     * @param {string} newContent
     * @param {number} cursorPosition
     * @returns {boolean}
     */
    shouldCreateNewState(newContent, cursorPosition) {
        // Always create state if history is empty
        if (this.history.length === 0) return true;

        const currentState = this.getCurrentState();
        if (!currentState) return true;

        // Create new state if content length changed significantly
        const lengthDiff = Math.abs(newContent.length - currentState.content.length);
        if (lengthDiff > 20) return true;

        // Create new state if cursor moved significantly
        const cursorDiff = Math.abs(cursorPosition - this.lastCursorPosition);
        if (cursorDiff > 50) return true;

        // Create new state if it's been more than 2 seconds since last state
        const timeDiff = Date.now() - currentState.timestamp;
        if (timeDiff > 2000) return true;

        // Create new state if user pressed Enter, space after a word, or punctuation
        const lastChar = newContent[cursorPosition - 1];
        const secondLastChar = newContent[cursorPosition - 2];
        if (lastChar === '\n' || 
            (lastChar === ' ' && secondLastChar && secondLastChar !== ' ') ||
            ['.', '!', '?', '。', '！', '？'].includes(lastChar)) {
            return true;
        }

        return false;
    }
}

// Export for use in editor
window.UndoRedoManager = UndoRedoManager;