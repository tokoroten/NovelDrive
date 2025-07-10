// Version Comparison UI Component

class VersionCompareUI {
    constructor(versionManager) {
        this.versionManager = versionManager;
        this.currentChapterId = null;
        this.selectedVersions = [];
        this.isVisible = false;
    }

    /**
     * Create and inject the version comparison modal
     */
    init() {
        // Create modal HTML
        const modalHTML = `
            <div id="version-compare-modal" class="modal version-modal" style="display: none;">
                <div class="modal-content modal-fullscreen">
                    <div class="modal-header">
                        <h3>バージョン比較</h3>
                        <div class="version-compare-controls">
                            <button class="secondary-btn" onclick="versionCompareUI.toggleView()">
                                <span class="icon">🔄</span>
                                表示切替
                            </button>
                            <button class="close-btn" onclick="versionCompareUI.close()">✕</button>
                        </div>
                    </div>
                    <div class="modal-body version-compare-body">
                        <div class="version-sidebar">
                            <h4>保存されたバージョン</h4>
                            <div id="version-list" class="version-list">
                                <!-- Version list will be populated here -->
                            </div>
                            <div class="version-actions">
                                <button class="primary-btn" onclick="versionCompareUI.compareSelected()" disabled>
                                    選択したバージョンを比較
                                </button>
                            </div>
                        </div>
                        <div class="version-content">
                            <div id="version-compare-view" class="version-compare-view">
                                <div class="compare-placeholder">
                                    <p>比較するバージョンを2つ選択してください</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add styles
        this.injectStyles();
    }

    /**
     * Inject required styles
     */
    injectStyles() {
        if (document.getElementById('version-compare-styles')) return;

        const styles = `
            <style id="version-compare-styles">
                .version-modal .modal-content {
                    width: 90vw;
                    height: 90vh;
                    max-width: 1400px;
                }

                .modal-fullscreen {
                    display: flex;
                    flex-direction: column;
                }

                .version-compare-body {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    gap: 0;
                }

                .version-sidebar {
                    width: 300px;
                    background: var(--bg-secondary);
                    padding: 1rem;
                    overflow-y: auto;
                    border-right: 1px solid var(--border-color);
                }

                .version-list {
                    margin: 1rem 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .version-item {
                    background: var(--bg-primary);
                    padding: 0.75rem;
                    border-radius: 8px;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.2s ease;
                }

                .version-item:hover {
                    border-color: var(--primary);
                    transform: translateX(2px);
                }

                .version-item.selected {
                    border-color: var(--primary);
                    background: var(--primary-light);
                }

                .version-item .version-date {
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin-bottom: 0.25rem;
                }

                .version-item .version-stats {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    display: flex;
                    justify-content: space-between;
                }

                .version-item .version-changes {
                    font-size: 0.8rem;
                    margin-top: 0.25rem;
                }

                .version-changes .added {
                    color: #4CAF50;
                }

                .version-changes .removed {
                    color: #f44336;
                }

                .version-content {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .version-compare-view {
                    flex: 1;
                    overflow: auto;
                    padding: 1rem;
                }

                .compare-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-secondary);
                }

                .compare-header {
                    display: flex;
                    justify-content: space-between;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border-color);
                }

                .compare-header .version-info {
                    flex: 1;
                    text-align: center;
                }

                .compare-content {
                    display: flex;
                    height: calc(100% - 80px);
                }

                .version-pane {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    font-family: monospace;
                    white-space: pre-wrap;
                    line-height: 1.6;
                }

                .version-pane.left {
                    border-right: 1px solid var(--border-color);
                }

                .diff-view {
                    padding: 1rem;
                    font-family: monospace;
                    white-space: pre-wrap;
                    line-height: 1.6;
                }

                .diff-line {
                    padding: 2px 8px;
                    margin: 1px 0;
                    border-radius: 3px;
                }

                .diff-line.added {
                    background: rgba(76, 175, 80, 0.1);
                    border-left: 3px solid #4CAF50;
                }

                .diff-line.removed {
                    background: rgba(244, 67, 54, 0.1);
                    border-left: 3px solid #f44336;
                    text-decoration: line-through;
                    opacity: 0.7;
                }

                .diff-line.unchanged {
                    color: var(--text-secondary);
                    opacity: 0.8;
                }

                .diff-stats {
                    padding: 1rem;
                    background: var(--bg-tertiary);
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    display: flex;
                    gap: 2rem;
                    justify-content: center;
                }

                .diff-stat {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .version-compare-controls {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .version-actions {
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                }

                .restore-version-btn {
                    background: var(--warning);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9rem;
                }

                .restore-version-btn:hover {
                    opacity: 0.9;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Open version comparison modal
     * @param {number} chapterId
     */
    open(chapterId) {
        this.currentChapterId = chapterId;
        this.selectedVersions = [];
        this.isVisible = true;
        
        const modal = document.getElementById('version-compare-modal');
        modal.style.display = 'flex';
        
        this.loadVersionList();
    }

    /**
     * Close the modal
     */
    close() {
        this.isVisible = false;
        document.getElementById('version-compare-modal').style.display = 'none';
        this.selectedVersions = [];
        this.clearCompareView();
    }

    /**
     * Load and display version list
     */
    loadVersionList() {
        const versions = this.versionManager.getVersions(this.currentChapterId);
        const listContainer = document.getElementById('version-list');
        
        if (versions.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">保存されたバージョンがありません</p>';
            return;
        }

        listContainer.innerHTML = versions.reverse().map(version => {
            const date = new Date(version.savedAt);
            const dateStr = date.toLocaleString('ja-JP');
            
            return `
                <div class="version-item" data-version-id="${version.id}">
                    <div class="version-date">${dateStr}</div>
                    <div class="version-stats">
                        <span>${version.wordCount.toLocaleString()}文字</span>
                        <span>v${version.id}</span>
                    </div>
                    ${version.changes ? `
                        <div class="version-changes">
                            ${version.changes.added > 0 ? `<span class="added">+${version.changes.added}</span>` : ''}
                            ${version.changes.removed > 0 ? `<span class="removed">-${version.changes.removed}</span>` : ''}
                            ${version.changes.modified > 0 ? `<span class="modified">~${version.changes.modified}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Add click handlers
        listContainer.querySelectorAll('.version-item').forEach(item => {
            item.addEventListener('click', () => this.toggleVersionSelection(item));
        });
    }

    /**
     * Toggle version selection
     * @param {HTMLElement} item
     */
    toggleVersionSelection(item) {
        const versionId = parseInt(item.dataset.versionId);
        const index = this.selectedVersions.indexOf(versionId);
        
        if (index > -1) {
            this.selectedVersions.splice(index, 1);
            item.classList.remove('selected');
        } else {
            if (this.selectedVersions.length >= 2) {
                // Remove oldest selection
                const oldestId = this.selectedVersions.shift();
                document.querySelector(`[data-version-id="${oldestId}"]`).classList.remove('selected');
            }
            this.selectedVersions.push(versionId);
            item.classList.add('selected');
        }

        // Update compare button state
        const compareBtn = document.querySelector('.version-actions .primary-btn');
        compareBtn.disabled = this.selectedVersions.length !== 2;
    }

    /**
     * Compare selected versions
     */
    compareSelected() {
        if (this.selectedVersions.length !== 2) return;

        const [versionId1, versionId2] = this.selectedVersions;
        const comparison = this.versionManager.compareVersions(
            this.currentChapterId,
            versionId1,
            versionId2
        );

        this.displayComparison(comparison);
    }

    /**
     * Display version comparison
     * @param {Object} comparison
     */
    displayComparison(comparison) {
        const compareView = document.getElementById('version-compare-view');
        
        compareView.innerHTML = `
            <div class="compare-header">
                <div class="version-info">
                    <strong>バージョン ${comparison.version1.id}</strong><br>
                    ${new Date(comparison.version1.savedAt).toLocaleString('ja-JP')}<br>
                    ${comparison.version1.wordCount.toLocaleString()}文字
                </div>
                <div class="version-info">
                    <strong>バージョン ${comparison.version2.id}</strong><br>
                    ${new Date(comparison.version2.savedAt).toLocaleString('ja-JP')}<br>
                    ${comparison.version2.wordCount.toLocaleString()}文字
                </div>
            </div>
            <div class="diff-stats">
                <div class="diff-stat">
                    <span class="added">追加: ${comparison.statistics.added}行</span>
                </div>
                <div class="diff-stat">
                    <span class="removed">削除: ${comparison.statistics.removed}行</span>
                </div>
                <div class="diff-stat">
                    <span>変更なし: ${comparison.statistics.unchanged}行</span>
                </div>
            </div>
            <div class="diff-view" id="diff-content">
                ${this.renderDiff(comparison.diff)}
            </div>
        `;

        // Add restore buttons
        this.addRestoreButtons(comparison);
    }

    /**
     * Render diff content
     * @param {Object} diff
     * @returns {string}
     */
    renderDiff(diff) {
        return diff.changes.map(change => {
            const content = this.escapeHtml(change.content || '');
            const lineNumbers = [];
            
            if (change.lineNumber1) lineNumbers.push(`L${change.lineNumber1}`);
            if (change.lineNumber2) lineNumbers.push(`L${change.lineNumber2}`);
            
            return `
                <div class="diff-line ${change.type}">
                    <span class="line-numbers">${lineNumbers.join(' → ')}</span>
                    ${content || '&nbsp;'}
                </div>
            `;
        }).join('');
    }

    /**
     * Toggle between different view modes
     */
    toggleView() {
        // This could toggle between unified diff, side-by-side, etc.
        // For now, just a placeholder
        console.log('Toggle view mode');
    }

    /**
     * Add restore buttons to comparison view
     * @param {Object} comparison
     */
    addRestoreButtons(comparison) {
        const header = document.querySelector('.compare-header');
        
        [comparison.version1, comparison.version2].forEach((version, index) => {
            const versionInfo = header.querySelectorAll('.version-info')[index];
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-version-btn';
            restoreBtn.textContent = 'このバージョンに戻す';
            restoreBtn.onclick = () => this.restoreVersion(version.id);
            versionInfo.appendChild(restoreBtn);
        });
    }

    /**
     * Restore a specific version
     * @param {number} versionId
     */
    async restoreVersion(versionId) {
        if (!confirm('このバージョンに戻しますか？現在の内容は新しいバージョンとして保存されます。')) {
            return;
        }

        const restored = this.versionManager.restoreVersion(this.currentChapterId, versionId);
        if (restored) {
            // Notify the editor to update content
            window.dispatchEvent(new CustomEvent('version-restored', {
                detail: restored
            }));
            
            this.close();
        }
    }

    /**
     * Clear comparison view
     */
    clearCompareView() {
        const compareView = document.getElementById('version-compare-view');
        compareView.innerHTML = `
            <div class="compare-placeholder">
                <p>比較するバージョンを2つ選択してください</p>
            </div>
        `;
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
}

// Create global instance
window.versionCompareUI = null;