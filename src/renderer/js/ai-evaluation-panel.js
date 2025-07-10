// AI Evaluation Panel - 右側に配置される評価パネル

class AIEvaluationPanel {
    constructor() {
        this.isVisible = false;
        this.currentEvaluation = null;
        this.evaluationInterval = null;
        this.autoEvaluate = false;
        this.init();
    }
    
    init() {
        this.createPanel();
        this.setupEventListeners();
        this.loadSettings();
    }
    
    createPanel() {
        // 既存のパネルがあれば削除
        const existingPanel = document.getElementById('ai-evaluation-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // 評価パネルを作成
        const panel = document.createElement('div');
        panel.id = 'ai-evaluation-panel';
        panel.className = 'ai-evaluation-panel';
        panel.innerHTML = `
            <div class="evaluation-panel-header">
                <h3>AI評価</h3>
                <div class="evaluation-panel-controls">
                    <button class="evaluation-toggle-btn" id="auto-evaluate-toggle" title="自動評価">
                        <span class="icon">🔄</span>
                    </button>
                    <button class="evaluation-close-btn" id="close-evaluation-panel" title="パネルを閉じる">
                        <span class="icon">✕</span>
                    </button>
                </div>
            </div>
            
            <div class="evaluation-panel-content">
                <div class="evaluation-empty-state" id="evaluation-empty-state">
                    <p>評価を実行するには、「評価を実行」ボタンをクリックしてください。</p>
                    <button class="evaluate-now-btn" id="evaluate-now">評価を実行</button>
                </div>
                
                <div class="evaluation-results" id="evaluation-results" style="display: none;">
                    <!-- 評価結果がここに表示されます -->
                </div>
                
                <div class="evaluation-loading" id="evaluation-loading" style="display: none;">
                    <div class="spinner"></div>
                    <p>評価中...</p>
                </div>
            </div>
            
            <div class="evaluation-panel-footer">
                <div class="evaluation-settings">
                    <label>
                        <input type="checkbox" id="real-time-evaluation">
                        リアルタイム評価
                    </label>
                    <label>
                        評価間隔:
                        <select id="evaluation-interval">
                            <option value="30">30秒</option>
                            <option value="60">1分</option>
                            <option value="300">5分</option>
                            <option value="600">10分</option>
                        </select>
                    </label>
                </div>
            </div>
        `;
        
        // ページに追加
        document.body.appendChild(panel);
    }
    
    setupEventListeners() {
        // パネルを閉じる
        document.getElementById('close-evaluation-panel')?.addEventListener('click', () => {
            this.hide();
        });
        
        // 評価を実行
        document.getElementById('evaluate-now')?.addEventListener('click', () => {
            this.executeEvaluation();
        });
        
        // 自動評価トグル
        document.getElementById('auto-evaluate-toggle')?.addEventListener('click', () => {
            this.toggleAutoEvaluation();
        });
        
        // リアルタイム評価
        document.getElementById('real-time-evaluation')?.addEventListener('change', (e) => {
            this.setRealTimeEvaluation(e.target.checked);
        });
        
        // 評価間隔
        document.getElementById('evaluation-interval')?.addEventListener('change', (e) => {
            this.setEvaluationInterval(parseInt(e.target.value));
        });
        
        // ツールバーの評価ボタンを更新
        this.updateToolbarButton();
    }
    
    updateToolbarButton() {
        const evaluateBtn = document.getElementById('ai-evaluate');
        if (evaluateBtn) {
            // クリックイベントを上書き
            evaluateBtn.replaceWith(evaluateBtn.cloneNode(true));
            const newBtn = document.getElementById('ai-evaluate');
            
            newBtn.addEventListener('click', () => {
                this.toggle();
            });
            
            // ボタンのスタイルを更新
            if (this.isVisible) {
                newBtn.classList.add('active');
            }
        }
    }
    
    show() {
        const panel = document.getElementById('ai-evaluation-panel');
        if (panel) {
            panel.classList.add('visible');
            this.isVisible = true;
            
            // エディタコンテナにクラスを追加
            const editorContainer = document.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.classList.add('with-evaluation-panel');
            }
            
            // ツールバーボタンをアクティブに
            document.getElementById('ai-evaluate')?.classList.add('active');
            
            this.saveSettings();
        }
    }
    
    hide() {
        const panel = document.getElementById('ai-evaluation-panel');
        if (panel) {
            panel.classList.remove('visible');
            this.isVisible = false;
            
            // エディタコンテナからクラスを削除
            const editorContainer = document.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.classList.remove('with-evaluation-panel');
            }
            
            // ツールバーボタンを非アクティブに
            document.getElementById('ai-evaluate')?.classList.remove('active');
            
            this.saveSettings();
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
            // 初回表示時は自動的に評価を実行
            if (!this.currentEvaluation) {
                this.executeEvaluation();
            }
        }
    }
    
    async executeEvaluation() {
        const editor = document.getElementById('editor');
        const text = editor?.value;
        
        if (!text || !text.trim()) {
            this.showEmptyState();
            return;
        }
        
        this.showLoading();
        
        try {
            // 現在のAIパーソナリティを取得
            const currentStyle = window.aiAssistant?.currentStyle || 'sharp';
            const personalityId = `writer_${currentStyle}`;
            
            // 評価を実行
            if (window.personalityCriteriaLink) {
                const evaluation = await window.personalityCriteriaLink.evaluateTextWithPersonality(
                    text,
                    personalityId
                );
                
                if (evaluation) {
                    this.displayResults(evaluation);
                } else {
                    this.showNoCriteriaMessage();
                }
            }
        } catch (error) {
            console.error('Evaluation failed:', error);
            this.showError('評価中にエラーが発生しました。');
        }
    }
    
    displayResults(evaluation) {
        const resultsContainer = document.getElementById('evaluation-results');
        const emptyState = document.getElementById('evaluation-empty-state');
        const loading = document.getElementById('evaluation-loading');
        
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="evaluation-score">
                <div class="total-score">${evaluation.totalScore}/100</div>
                <div class="score-label">総合評価</div>
            </div>
            
            <div class="score-breakdown">
                <h4>詳細スコア</h4>
                ${Object.entries(evaluation.scores).map(([criterion, score]) => `
                    <div class="score-item">
                        <span class="criterion-label">${this.getCriterionLabel(criterion)}</span>
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${score}%"></div>
                        </div>
                        <span class="score-value">${Math.round(score)}</span>
                    </div>
                `).join('')}
            </div>
            
            <div class="evaluation-feedback">
                <h4>フィードバック</h4>
                <p>${evaluation.feedback}</p>
            </div>
            
            <div class="evaluation-suggestions">
                <h4>改善提案</h4>
                <ul>
                    ${evaluation.suggestions.map(suggestion => `
                        <li>${suggestion}</li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="evaluation-actions">
                <button class="refresh-evaluation-btn" onclick="window.aiEvaluationPanel.executeEvaluation()">
                    再評価
                </button>
                <button class="evaluation-settings-btn" onclick="window.personalityCriteriaLink.showLinkSettings()">
                    評価基準を設定
                </button>
            </div>
        `;
        
        // 表示を切り替え
        emptyState.style.display = 'none';
        loading.style.display = 'none';
        resultsContainer.style.display = 'block';
        
        this.currentEvaluation = evaluation;
    }
    
    showEmptyState() {
        const resultsContainer = document.getElementById('evaluation-results');
        const emptyState = document.getElementById('evaluation-empty-state');
        const loading = document.getElementById('evaluation-loading');
        
        if (emptyState) {
            emptyState.style.display = 'block';
            loading.style.display = 'none';
            resultsContainer.style.display = 'none';
        }
    }
    
    showLoading() {
        const resultsContainer = document.getElementById('evaluation-results');
        const emptyState = document.getElementById('evaluation-empty-state');
        const loading = document.getElementById('evaluation-loading');
        
        if (loading) {
            emptyState.style.display = 'none';
            resultsContainer.style.display = 'none';
            loading.style.display = 'block';
        }
    }
    
    showNoCriteriaMessage() {
        const resultsContainer = document.getElementById('evaluation-results');
        const emptyState = document.getElementById('evaluation-empty-state');
        const loading = document.getElementById('evaluation-loading');
        
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="no-criteria-message">
                    <p>このAIパーソナリティには評価基準が設定されていません。</p>
                    <button class="evaluation-settings-btn" onclick="window.personalityCriteriaLink.showLinkSettings()">
                        評価基準を設定
                    </button>
                </div>
            `;
            
            emptyState.style.display = 'none';
            loading.style.display = 'none';
            resultsContainer.style.display = 'block';
        }
    }
    
    showError(message) {
        const resultsContainer = document.getElementById('evaluation-results');
        const emptyState = document.getElementById('evaluation-empty-state');
        const loading = document.getElementById('evaluation-loading');
        
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="evaluation-error">
                    <p>${message}</p>
                    <button onclick="window.aiEvaluationPanel.executeEvaluation()">再試行</button>
                </div>
            `;
            
            emptyState.style.display = 'none';
            loading.style.display = 'none';
            resultsContainer.style.display = 'block';
        }
    }
    
    toggleAutoEvaluation() {
        this.autoEvaluate = !this.autoEvaluate;
        const btn = document.getElementById('auto-evaluate-toggle');
        
        if (btn) {
            if (this.autoEvaluate) {
                btn.classList.add('active');
                this.startAutoEvaluation();
            } else {
                btn.classList.remove('active');
                this.stopAutoEvaluation();
            }
        }
        
        this.saveSettings();
    }
    
    setRealTimeEvaluation(enabled) {
        if (enabled) {
            this.setupRealTimeEvaluation();
        } else {
            this.disableRealTimeEvaluation();
        }
        
        this.saveSettings();
    }
    
    setEvaluationInterval(seconds) {
        this.evaluationIntervalSeconds = seconds;
        
        if (this.autoEvaluate) {
            this.stopAutoEvaluation();
            this.startAutoEvaluation();
        }
        
        this.saveSettings();
    }
    
    startAutoEvaluation() {
        const interval = (this.evaluationIntervalSeconds || 60) * 1000;
        
        this.evaluationInterval = setInterval(() => {
            if (this.isVisible) {
                this.executeEvaluation();
            }
        }, interval);
    }
    
    stopAutoEvaluation() {
        if (this.evaluationInterval) {
            clearInterval(this.evaluationInterval);
            this.evaluationInterval = null;
        }
    }
    
    setupRealTimeEvaluation() {
        let evaluationTimer = null;
        const editor = document.getElementById('editor');
        
        if (!editor) return;
        
        const handleInput = () => {
            clearTimeout(evaluationTimer);
            evaluationTimer = setTimeout(() => {
                if (this.isVisible) {
                    this.executeEvaluation();
                }
            }, 3000); // 3秒後に評価
        };
        
        editor.addEventListener('input', handleInput);
        this.realTimeHandler = handleInput;
    }
    
    disableRealTimeEvaluation() {
        const editor = document.getElementById('editor');
        if (editor && this.realTimeHandler) {
            editor.removeEventListener('input', this.realTimeHandler);
            this.realTimeHandler = null;
        }
    }
    
    getCriterionLabel(criterion) {
        const labels = {
            originality: '独創性',
            consistency: '一貫性',
            emotionalImpact: '感情的インパクト',
            pacing: 'ペース配分',
            characterDepth: 'キャラクターの深み',
            worldBuilding: '世界観構築',
            dialogue: '会話',
            plotDevelopment: 'プロット展開'
        };
        return labels[criterion] || criterion;
    }
    
    saveSettings() {
        const settings = {
            isVisible: this.isVisible,
            autoEvaluate: this.autoEvaluate,
            evaluationInterval: this.evaluationIntervalSeconds || 60,
            realTimeEvaluation: document.getElementById('real-time-evaluation')?.checked || false
        };
        
        localStorage.setItem('ai-evaluation-panel-settings', JSON.stringify(settings));
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('ai-evaluation-panel-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                
                if (settings.isVisible) {
                    this.show();
                }
                
                if (settings.autoEvaluate) {
                    this.toggleAutoEvaluation();
                }
                
                if (settings.evaluationInterval) {
                    document.getElementById('evaluation-interval').value = settings.evaluationInterval;
                    this.evaluationIntervalSeconds = settings.evaluationInterval;
                }
                
                if (settings.realTimeEvaluation) {
                    document.getElementById('real-time-evaluation').checked = true;
                    this.setRealTimeEvaluation(true);
                }
            }
        } catch (error) {
            console.error('Failed to load evaluation panel settings:', error);
        }
    }
}

// Initialize AI Evaluation Panel
window.aiEvaluationPanel = new AIEvaluationPanel();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIEvaluationPanel;
}