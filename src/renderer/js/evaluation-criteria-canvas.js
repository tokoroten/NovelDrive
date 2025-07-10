// 評価基準キャンバス - AIと対話しながら評価基準を視覚的にカスタマイズ

class EvaluationCriteriaCanvas {
    constructor() {
        this.api = window.api || window.mockAPI;
        this.canvas = null;
        this.ctx = null;
        this.criteria = new Map();
        this.selectedCriterion = null;
        this.isDragging = false;
        this.aiAssistant = null;
        
        // デフォルトの評価基準
        this.defaultCriteria = {
            plot: [
                {
                    id: 'plot_structure',
                    name: '構成力',
                    category: 'plot',
                    position: { x: 200, y: 150 },
                    weight: 0.25,
                    subCriteria: {
                        beginning: { name: '導入', weight: 0.3, score: 0 },
                        development: { name: '展開', weight: 0.4, score: 0 },
                        climax: { name: 'クライマックス', weight: 0.2, score: 0 },
                        ending: { name: '結末', weight: 0.1, score: 0 }
                    },
                    color: '#FF6B6B',
                    description: '物語の構成がどれだけ効果的か'
                },
                {
                    id: 'plot_originality',
                    name: '独創性',
                    category: 'plot',
                    position: { x: 400, y: 150 },
                    weight: 0.2,
                    subCriteria: {
                        premise: { name: '前提', weight: 0.4, score: 0 },
                        twists: { name: '展開の意外性', weight: 0.3, score: 0 },
                        worldbuilding: { name: '世界観', weight: 0.3, score: 0 }
                    },
                    color: '#4ECDC4',
                    description: 'アイデアや設定の新しさ'
                },
                {
                    id: 'plot_coherence',
                    name: '整合性',
                    category: 'plot',
                    position: { x: 600, y: 150 },
                    weight: 0.15,
                    subCriteria: {
                        logic: { name: '論理性', weight: 0.5, score: 0 },
                        consistency: { name: '一貫性', weight: 0.5, score: 0 }
                    },
                    color: '#FFD93D',
                    description: '設定や展開の矛盾のなさ'
                }
            ],
            writing: [
                {
                    id: 'writing_style',
                    name: '文体',
                    category: 'writing',
                    position: { x: 200, y: 350 },
                    weight: 0.3,
                    subCriteria: {
                        readability: { name: '読みやすさ', weight: 0.3, score: 0 },
                        rhythm: { name: 'リズム', weight: 0.3, score: 0 },
                        voice: { name: '個性', weight: 0.4, score: 0 }
                    },
                    color: '#A855F7',
                    description: '文章の質と個性'
                },
                {
                    id: 'writing_emotion',
                    name: '感情表現',
                    category: 'writing',
                    position: { x: 400, y: 350 },
                    weight: 0.25,
                    subCriteria: {
                        impact: { name: 'インパクト', weight: 0.4, score: 0 },
                        nuance: { name: 'ニュアンス', weight: 0.3, score: 0 },
                        resonance: { name: '共感性', weight: 0.3, score: 0 }
                    },
                    color: '#3B82F6',
                    description: '読者の心を動かす力'
                },
                {
                    id: 'writing_description',
                    name: '描写力',
                    category: 'writing',
                    position: { x: 600, y: 350 },
                    weight: 0.2,
                    subCriteria: {
                        vividness: { name: '鮮明さ', weight: 0.4, score: 0 },
                        efficiency: { name: '効率性', weight: 0.3, score: 0 },
                        atmosphere: { name: '雰囲気', weight: 0.3, score: 0 }
                    },
                    color: '#10B981',
                    description: '場面や情景を伝える力'
                }
            ],
            character: [
                {
                    id: 'char_depth',
                    name: 'キャラクター深度',
                    category: 'character',
                    position: { x: 300, y: 250 },
                    weight: 0.35,
                    subCriteria: {
                        complexity: { name: '複雑性', weight: 0.4, score: 0 },
                        growth: { name: '成長', weight: 0.3, score: 0 },
                        motivation: { name: '動機', weight: 0.3, score: 0 }
                    },
                    color: '#F59E0B',
                    description: 'キャラクターの立体感'
                },
                {
                    id: 'char_dialogue',
                    name: '対話',
                    category: 'character',
                    position: { x: 500, y: 250 },
                    weight: 0.25,
                    subCriteria: {
                        naturalness: { name: '自然さ', weight: 0.4, score: 0 },
                        distinctiveness: { name: '個性', weight: 0.3, score: 0 },
                        subtext: { name: 'サブテキスト', weight: 0.3, score: 0 }
                    },
                    color: '#EC4899',
                    description: '対話の質と効果'
                }
            ]
        };
        
        this.initialize();
    }
    
    async initialize() {
        await this.loadCriteria();
        this.createUI();
        this.setupEventListeners();
        this.initializeAIAssistant();
        this.render();
    }
    
    createUI() {
        const container = document.createElement('div');
        container.id = 'evaluation-criteria-canvas-container';
        container.innerHTML = `
            <div class="eval-canvas-header">
                <h2>評価基準カスタマイズ</h2>
                <div class="canvas-controls">
                    <button onclick="window.evalCanvas.addCriterion()">
                        <span class="icon">➕</span> 基準追加
                    </button>
                    <button onclick="window.evalCanvas.askAI()">
                        <span class="icon">🤖</span> AI相談
                    </button>
                    <button onclick="window.evalCanvas.autoBalance()">
                        <span class="icon">⚖️</span> 自動調整
                    </button>
                    <button onclick="window.evalCanvas.savePreset()">
                        <span class="icon">💾</span> プリセット保存
                    </button>
                </div>
            </div>
            
            <div class="eval-canvas-workspace">
                <div class="canvas-sidebar">
                    <div class="weight-summary">
                        <h3>重み配分</h3>
                        <div id="weight-distribution"></div>
                        <div class="total-weight">
                            合計: <span id="total-weight">100%</span>
                        </div>
                    </div>
                    
                    <div class="presets">
                        <h3>プリセット</h3>
                        <select id="preset-selector" onchange="window.evalCanvas.loadPreset(this.value)">
                            <option value="balanced">バランス型</option>
                            <option value="plot-focused">プロット重視</option>
                            <option value="character-focused">キャラクター重視</option>
                            <option value="literary">純文学型</option>
                            <option value="commercial">商業小説型</option>
                            <option value="web-novel">Web小説型</option>
                        </select>
                    </div>
                    
                    <div class="ai-suggestions" id="ai-suggestions" style="display: none;">
                        <h3>AI提案</h3>
                        <div class="suggestions-content"></div>
                    </div>
                </div>
                
                <canvas id="evaluation-criteria-canvas" width="800" height="600"></canvas>
                
                <div class="criterion-inspector" id="criterion-inspector" style="display: none;">
                    <h3>評価基準の詳細</h3>
                    <div class="inspector-content"></div>
                </div>
            </div>
            
            <div class="ai-chat-panel" id="ai-chat-panel" style="display: none;">
                <div class="chat-header">
                    <h3>AI評価アドバイザー</h3>
                    <button onclick="window.evalCanvas.closeAIChat()">✕</button>
                </div>
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input">
                    <input type="text" id="chat-input" placeholder="評価基準について質問してください...">
                    <button onclick="window.evalCanvas.sendMessage()">送信</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        this.canvas = document.getElementById('evaluation-criteria-canvas');
        this.ctx = this.canvas.getContext('2d');
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // チャット入力のエンターキー
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }
    
    async initializeAIAssistant() {
        // AI評価アドバイザーの初期化
        this.aiAssistant = {
            personality: {
                name: '評価基準アドバイザー',
                role: 'あなたは小説の評価基準について深い知識を持つアドバイザーです。',
                traits: {
                    analytical: 90,
                    creative: 70,
                    supportive: 85
                }
            },
            threadId: 'eval_criteria_advisor'
        };
    }
    
    async loadCriteria() {
        try {
            // 保存された基準を読み込み
            const saved = localStorage.getItem('evaluation-criteria');
            if (saved) {
                const data = JSON.parse(saved);
                data.forEach(criterion => {
                    this.criteria.set(criterion.id, criterion);
                });
            } else {
                // デフォルトを使用
                this.loadDefaultCriteria();
            }
        } catch (error) {
            console.error('Failed to load criteria:', error);
            this.loadDefaultCriteria();
        }
    }
    
    loadDefaultCriteria() {
        Object.values(this.defaultCriteria).flat().forEach(criterion => {
            this.criteria.set(criterion.id, criterion);
        });
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 背景グリッド
        this.drawGrid();
        
        // カテゴリ領域
        this.drawCategories();
        
        // 接続線
        this.drawConnections();
        
        // 評価基準ノード
        this.drawCriteria();
        
        // 重み配分を更新
        this.updateWeightDistribution();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#E5E7EB';
        this.ctx.lineWidth = 0.5;
        
        for (let x = 0; x < this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawCategories() {
        const categories = [
            { name: 'プロット', y: 100, color: 'rgba(255, 107, 107, 0.1)' },
            { name: 'キャラクター', y: 250, color: 'rgba(249, 158, 11, 0.1)' },
            { name: '文章', y: 400, color: 'rgba(168, 85, 247, 0.1)' }
        ];
        
        categories.forEach(cat => {
            this.ctx.fillStyle = cat.color;
            this.ctx.fillRect(0, cat.y - 50, this.canvas.width, 100);
            
            this.ctx.fillStyle = '#6B7280';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(cat.name, 10, cat.y);
        });
    }
    
    drawConnections() {
        // 基準間の関連性を表示
        this.criteria.forEach(criterion => {
            if (criterion.relatedTo) {
                criterion.relatedTo.forEach(relatedId => {
                    const related = this.criteria.get(relatedId);
                    if (related) {
                        this.drawConnection(criterion, related);
                    }
                });
            }
        });
    }
    
    drawConnection(from, to) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(156, 163, 175, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.moveTo(from.position.x, from.position.y);
        this.ctx.lineTo(to.position.x, to.position.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawCriteria() {
        this.criteria.forEach(criterion => {
            this.drawCriterion(criterion);
        });
    }
    
    drawCriterion(criterion) {
        const { position, color, name, weight } = criterion;
        const radius = 30 + weight * 50; // 重みに応じてサイズ変更
        
        // 外円
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = color + '40'; // 透明度を追加
        this.ctx.fill();
        
        // 内円
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, radius - 10, 0, Math.PI * 2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // テキスト
        this.ctx.fillStyle = '#1F2937';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(name, position.x, position.y - 5);
        
        // 重み表示
        this.ctx.font = '10px sans-serif';
        this.ctx.fillText(`${Math.round(weight * 100)}%`, position.x, position.y + 10);
        
        // サブ基準インジケーター
        if (criterion.subCriteria) {
            this.drawSubCriteriaIndicators(criterion, radius);
        }
    }
    
    drawSubCriteriaIndicators(criterion, radius) {
        const subCriteria = Object.values(criterion.subCriteria);
        const angleStep = (Math.PI * 2) / subCriteria.length;
        
        subCriteria.forEach((sub, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const x = criterion.position.x + Math.cos(angle) * (radius + 15);
            const y = criterion.position.y + Math.sin(angle) * (radius + 15);
            
            // インジケーター
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4 + sub.weight * 6, 0, Math.PI * 2);
            this.ctx.fillStyle = criterion.color;
            this.ctx.fill();
        });
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clicked = this.findCriterionAt(x, y);
        
        if (clicked) {
            this.selectedCriterion = clicked;
            this.isDragging = true;
            this.dragOffset = {
                x: x - clicked.position.x,
                y: y - clicked.position.y
            };
            
            this.updateInspector(clicked);
        } else {
            this.selectedCriterion = null;
            this.hideInspector();
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        if (!this.isDragging || !this.selectedCriterion) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.selectedCriterion.position = {
            x: x - this.dragOffset.x,
            y: y - this.dragOffset.y
        };
        
        this.render();
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        
        if (this.selectedCriterion) {
            this.saveCriteria();
        }
    }
    
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const criterion = this.findCriterionAt(x, y);
        
        if (criterion) {
            this.editCriterion(criterion);
        }
    }
    
    findCriterionAt(x, y) {
        for (const [id, criterion] of this.criteria) {
            const dist = Math.sqrt(
                Math.pow(x - criterion.position.x, 2) +
                Math.pow(y - criterion.position.y, 2)
            );
            
            const radius = 30 + criterion.weight * 50;
            if (dist <= radius) {
                return criterion;
            }
        }
        return null;
    }
    
    updateInspector(criterion) {
        const inspector = document.getElementById('criterion-inspector');
        const content = inspector.querySelector('.inspector-content');
        
        content.innerHTML = `
            <div class="criterion-field">
                <label>名前:</label>
                <input type="text" value="${criterion.name}" 
                       onchange="window.evalCanvas.updateCriterionName('${criterion.id}', this.value)">
            </div>
            
            <div class="criterion-field">
                <label>説明:</label>
                <textarea onchange="window.evalCanvas.updateCriterionDescription('${criterion.id}', this.value)">${criterion.description || ''}</textarea>
            </div>
            
            <div class="criterion-field">
                <label>重み:</label>
                <input type="range" min="0" max="100" value="${criterion.weight * 100}" 
                       onchange="window.evalCanvas.updateCriterionWeight('${criterion.id}', this.value / 100)">
                <span>${Math.round(criterion.weight * 100)}%</span>
            </div>
            
            <div class="sub-criteria">
                <h4>サブ基準</h4>
                ${this.renderSubCriteria(criterion)}
                <button onclick="window.evalCanvas.addSubCriterion('${criterion.id}')">
                    サブ基準を追加
                </button>
            </div>
            
            <div class="criterion-actions">
                <button onclick="window.evalCanvas.askAIAboutCriterion('${criterion.id}')">
                    AIに相談
                </button>
                <button onclick="window.evalCanvas.deleteCriterion('${criterion.id}')" class="danger">
                    削除
                </button>
            </div>
        `;
        
        inspector.style.display = 'block';
    }
    
    renderSubCriteria(criterion) {
        if (!criterion.subCriteria) return '';
        
        return Object.entries(criterion.subCriteria).map(([key, sub]) => `
            <div class="sub-criterion">
                <input type="text" value="${sub.name}" 
                       onchange="window.evalCanvas.updateSubCriterion('${criterion.id}', '${key}', 'name', this.value)">
                <input type="range" min="0" max="100" value="${sub.weight * 100}"
                       onchange="window.evalCanvas.updateSubCriterion('${criterion.id}', '${key}', 'weight', this.value / 100)">
                <span>${Math.round(sub.weight * 100)}%</span>
                <button onclick="window.evalCanvas.removeSubCriterion('${criterion.id}', '${key}')">✕</button>
            </div>
        `).join('');
    }
    
    hideInspector() {
        document.getElementById('criterion-inspector').style.display = 'none';
    }
    
    updateWeightDistribution() {
        const distribution = {};
        let total = 0;
        
        this.criteria.forEach(criterion => {
            const category = criterion.category || 'other';
            if (!distribution[category]) {
                distribution[category] = 0;
            }
            distribution[category] += criterion.weight;
            total += criterion.weight;
        });
        
        const container = document.getElementById('weight-distribution');
        container.innerHTML = Object.entries(distribution).map(([cat, weight]) => `
            <div class="weight-item">
                <span>${this.getCategoryLabel(cat)}:</span>
                <span>${Math.round(weight * 100)}%</span>
            </div>
        `).join('');
        
        document.getElementById('total-weight').textContent = `${Math.round(total * 100)}%`;
        
        // 合計が100%でない場合は警告
        if (Math.abs(total - 1) > 0.01) {
            document.getElementById('total-weight').style.color = '#EF4444';
        } else {
            document.getElementById('total-weight').style.color = '#10B981';
        }
    }
    
    getCategoryLabel(category) {
        const labels = {
            plot: 'プロット',
            writing: '文章',
            character: 'キャラクター',
            other: 'その他'
        };
        return labels[category] || category;
    }
    
    askAI() {
        const chatPanel = document.getElementById('ai-chat-panel');
        chatPanel.style.display = 'block';
        
        // 初期メッセージ
        this.addChatMessage('assistant', `こんにちは！評価基準のカスタマイズについてお手伝いします。
        
現在の評価基準の配分を見ると、${this.analyzeCurrentDistribution()}

どのような点を改善したいですか？例えば：
- 特定のジャンルに最適化したい
- バランスを調整したい
- 新しい評価軸を追加したい`);
    }
    
    analyzeCurrentDistribution() {
        const distribution = {};
        this.criteria.forEach(criterion => {
            const category = criterion.category || 'other';
            if (!distribution[category]) {
                distribution[category] = 0;
            }
            distribution[category] += criterion.weight;
        });
        
        const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
        return `${this.getCategoryLabel(sorted[0][0])}に${Math.round(sorted[0][1] * 100)}%の重みが置かれています。`;
    }
    
    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // ユーザーメッセージを追加
        this.addChatMessage('user', message);
        input.value = '';
        
        // AI応答を生成
        const response = await this.generateAIResponse(message);
        this.addChatMessage('assistant', response);
        
        // 提案がある場合は表示
        const suggestions = await this.generateSuggestions(message);
        if (suggestions.length > 0) {
            this.showSuggestions(suggestions);
        }
    }
    
    async generateAIResponse(message) {
        // メッセージの内容を分析
        const intent = this.analyzeIntent(message);
        
        switch (intent.type) {
            case 'genre_optimization':
                return this.respondToGenreOptimization(intent.genre);
            case 'balance_adjustment':
                return this.respondToBalanceAdjustment();
            case 'criterion_addition':
                return this.respondToCriterionAddition(intent.criterion);
            case 'explanation':
                return this.respondToExplanation(intent.topic);
            default:
                return this.respondToGeneral(message);
        }
    }
    
    analyzeIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('ジャンル') || lowerMessage.includes('なろう') || lowerMessage.includes('純文学')) {
            return { type: 'genre_optimization', genre: this.detectGenre(lowerMessage) };
        } else if (lowerMessage.includes('バランス') || lowerMessage.includes('調整')) {
            return { type: 'balance_adjustment' };
        } else if (lowerMessage.includes('追加') || lowerMessage.includes('新しい')) {
            return { type: 'criterion_addition', criterion: this.detectCriterion(lowerMessage) };
        } else if (lowerMessage.includes('とは') || lowerMessage.includes('説明')) {
            return { type: 'explanation', topic: this.detectTopic(lowerMessage) };
        }
        
        return { type: 'general' };
    }
    
    respondToGenreOptimization(genre) {
        const genreProfiles = {
            'なろう': {
                plot_structure: 0.2,
                plot_originality: 0.15,
                writing_style: 0.25,
                char_depth: 0.3,
                writing_emotion: 0.1
            },
            '純文学': {
                plot_structure: 0.15,
                writing_style: 0.35,
                writing_description: 0.25,
                char_depth: 0.2,
                plot_originality: 0.05
            },
            'ライトノベル': {
                char_dialogue: 0.3,
                plot_structure: 0.25,
                writing_emotion: 0.2,
                plot_originality: 0.15,
                writing_style: 0.1
            }
        };
        
        const profile = genreProfiles[genre] || genreProfiles['なろう'];
        
        return `${genre}に最適化する場合、以下のような配分をお勧めします：

${Object.entries(profile).map(([id, weight]) => {
    const criterion = this.criteria.get(id);
    return criterion ? `・${criterion.name}: ${Math.round(weight * 100)}%` : '';
}).filter(Boolean).join('\n')}

この配分は${genre}の読者が重視する要素を反映しています。適用しますか？`;
    }
    
    respondToBalanceAdjustment() {
        return `現在の配分を分析しました。以下の調整案があります：

1. **均等配分案**: すべての主要基準を同じ重みに
2. **段階的配分案**: 重要度に応じて段階的に配分
3. **特化型配分案**: 1-2の基準に重点を置く

どの方向で調整したいですか？`;
    }
    
    respondToCriterionAddition(criterion) {
        return `新しい評価基準「${criterion || ''}」を追加することができます。

追加する場合は、以下を考慮してください：
- 既存の基準との重複を避ける
- 測定可能な要素にする
- 全体の重み配分を再調整する

どのような基準を追加したいですか？`;
    }
    
    respondToExplanation(topic) {
        const explanations = {
            '構成力': '物語の始まり、中盤、クライマックス、結末がどれだけ効果的に配置され、読者を引き込む流れを作っているかを評価します。',
            '独創性': 'アイデア、設定、展開において、既存の作品とは異なる新しさや驚きがあるかを評価します。',
            '文体': '文章のリズム、語彙選択、表現技法など、作者独自の文章スタイルの質を評価します。'
        };
        
        return explanations[topic] || `${topic}についての詳しい説明をお求めですね。この評価基準は作品の質を多角的に判断するための重要な要素です。`;
    }
    
    respondToGeneral(message) {
        return `評価基準のカスタマイズについて、どのようなお手伝いができますか？

可能なこと：
- ジャンルに合わせた最適化
- 重み配分の調整
- 新しい評価軸の追加
- 既存基準の説明

お気軽にご質問ください。`;
    }
    
    detectGenre(message) {
        if (message.includes('なろう')) return 'なろう';
        if (message.includes('純文学')) return '純文学';
        if (message.includes('ライトノベル') || message.includes('ラノベ')) return 'ライトノベル';
        return 'general';
    }
    
    detectCriterion(message) {
        // メッセージから基準名を抽出（簡易実装）
        return '';
    }
    
    detectTopic(message) {
        const topics = ['構成力', '独創性', '文体', 'キャラクター', '感情表現'];
        for (const topic of topics) {
            if (message.includes(topic)) return topic;
        }
        return '';
    }
    
    async generateSuggestions(message) {
        // コンテキストに基づいた提案を生成
        const suggestions = [];
        
        // 現在の配分を分析
        const analysis = this.analyzeDistribution();
        
        if (analysis.imbalanced) {
            suggestions.push({
                type: 'balance',
                title: 'バランス調整',
                description: '重み配分を最適化',
                action: () => this.autoBalance()
            });
        }
        
        if (analysis.missingCategories.length > 0) {
            suggestions.push({
                type: 'add',
                title: '不足基準の追加',
                description: `${analysis.missingCategories.join(', ')}の基準を追加`,
                action: () => this.addMissingCriteria(analysis.missingCategories)
            });
        }
        
        return suggestions;
    }
    
    analyzeDistribution() {
        const distribution = {};
        const allCategories = ['plot', 'writing', 'character'];
        
        this.criteria.forEach(criterion => {
            const category = criterion.category || 'other';
            if (!distribution[category]) {
                distribution[category] = 0;
            }
            distribution[category] += criterion.weight;
        });
        
        const missingCategories = allCategories.filter(cat => !distribution[cat] || distribution[cat] < 0.1);
        
        // バランスチェック
        const weights = Object.values(distribution);
        const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
        const variance = weights.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / weights.length;
        const imbalanced = variance > 0.05;
        
        return { distribution, missingCategories, imbalanced };
    }
    
    showSuggestions(suggestions) {
        const container = document.getElementById('ai-suggestions');
        const content = container.querySelector('.suggestions-content');
        
        content.innerHTML = suggestions.map(sug => `
            <div class="suggestion-item">
                <h4>${sug.title}</h4>
                <p>${sug.description}</p>
                <button onclick="window.evalCanvas.applySuggestion('${sug.type}')">
                    適用
                </button>
            </div>
        `).join('');
        
        container.style.display = 'block';
        
        // 提案を保存
        this.pendingSuggestions = suggestions;
    }
    
    applySuggestion(type) {
        const suggestion = this.pendingSuggestions?.find(s => s.type === type);
        if (suggestion && suggestion.action) {
            suggestion.action();
        }
    }
    
    addChatMessage(role, content) {
        const messagesContainer = document.getElementById('chat-messages');
        const message = document.createElement('div');
        message.className = `chat-message ${role}`;
        message.innerHTML = `
            <div class="message-header">${role === 'user' ? 'あなた' : 'AI'}</div>
            <div class="message-content">${content}</div>
        `;
        
        messagesContainer.appendChild(message);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    closeAIChat() {
        document.getElementById('ai-chat-panel').style.display = 'none';
    }
    
    addCriterion() {
        const id = `custom_${Date.now()}`;
        const criterion = {
            id,
            name: '新しい基準',
            category: 'other',
            position: { x: 400, y: 300 },
            weight: 0.1,
            subCriteria: {},
            color: this.getRandomColor(),
            description: ''
        };
        
        this.criteria.set(id, criterion);
        this.selectedCriterion = criterion;
        this.render();
        this.updateInspector(criterion);
    }
    
    autoBalance() {
        const total = Array.from(this.criteria.values()).reduce((sum, c) => sum + c.weight, 0);
        const avgWeight = 1 / this.criteria.size;
        
        this.criteria.forEach(criterion => {
            criterion.weight = avgWeight;
        });
        
        this.render();
        this.saveCriteria();
    }
    
    loadPreset(presetName) {
        const presets = {
            'balanced': {
                weights: {
                    plot_structure: 0.2,
                    plot_originality: 0.15,
                    plot_coherence: 0.1,
                    writing_style: 0.2,
                    writing_emotion: 0.15,
                    writing_description: 0.1,
                    char_depth: 0.1
                }
            },
            'plot-focused': {
                weights: {
                    plot_structure: 0.35,
                    plot_originality: 0.25,
                    plot_coherence: 0.15,
                    writing_style: 0.1,
                    writing_emotion: 0.05,
                    writing_description: 0.05,
                    char_depth: 0.05
                }
            },
            'character-focused': {
                weights: {
                    char_depth: 0.35,
                    char_dialogue: 0.25,
                    plot_structure: 0.15,
                    writing_emotion: 0.15,
                    writing_style: 0.1
                }
            },
            'literary': {
                weights: {
                    writing_style: 0.35,
                    writing_description: 0.25,
                    char_depth: 0.2,
                    plot_originality: 0.1,
                    plot_structure: 0.1
                }
            },
            'commercial': {
                weights: {
                    plot_structure: 0.3,
                    char_depth: 0.25,
                    writing_emotion: 0.2,
                    plot_originality: 0.15,
                    writing_style: 0.1
                }
            },
            'web-novel': {
                weights: {
                    plot_structure: 0.25,
                    char_dialogue: 0.25,
                    writing_emotion: 0.2,
                    plot_originality: 0.15,
                    writing_style: 0.15
                }
            }
        };
        
        const preset = presets[presetName];
        if (!preset) return;
        
        // 重みを適用
        Object.entries(preset.weights).forEach(([id, weight]) => {
            const criterion = this.criteria.get(id);
            if (criterion) {
                criterion.weight = weight;
            }
        });
        
        this.render();
        this.saveCriteria();
    }
    
    savePreset() {
        const name = prompt('プリセット名を入力してください:');
        if (!name) return;
        
        const preset = {
            name,
            weights: {}
        };
        
        this.criteria.forEach((criterion, id) => {
            preset.weights[id] = criterion.weight;
        });
        
        // プリセットを保存
        const presets = JSON.parse(localStorage.getItem('evaluation-presets') || '{}');
        presets[name] = preset;
        localStorage.setItem('evaluation-presets', JSON.stringify(presets));
        
        alert(`プリセット「${name}」を保存しました`);
    }
    
    updateCriterionName(id, name) {
        const criterion = this.criteria.get(id);
        if (criterion) {
            criterion.name = name;
            this.render();
            this.saveCriteria();
        }
    }
    
    updateCriterionDescription(id, description) {
        const criterion = this.criteria.get(id);
        if (criterion) {
            criterion.description = description;
            this.saveCriteria();
        }
    }
    
    updateCriterionWeight(id, weight) {
        const criterion = this.criteria.get(id);
        if (criterion) {
            criterion.weight = weight;
            this.render();
            this.saveCriteria();
        }
    }
    
    updateSubCriterion(criterionId, subKey, field, value) {
        const criterion = this.criteria.get(criterionId);
        if (criterion && criterion.subCriteria[subKey]) {
            criterion.subCriteria[subKey][field] = value;
            this.render();
            this.saveCriteria();
        }
    }
    
    addSubCriterion(criterionId) {
        const criterion = this.criteria.get(criterionId);
        if (!criterion) return;
        
        const key = `sub_${Date.now()}`;
        criterion.subCriteria[key] = {
            name: '新しいサブ基準',
            weight: 0.2,
            score: 0
        };
        
        this.updateInspector(criterion);
        this.saveCriteria();
    }
    
    removeSubCriterion(criterionId, subKey) {
        const criterion = this.criteria.get(criterionId);
        if (criterion && criterion.subCriteria[subKey]) {
            delete criterion.subCriteria[subKey];
            this.updateInspector(criterion);
            this.saveCriteria();
        }
    }
    
    deleteCriterion(id) {
        if (confirm('この評価基準を削除しますか？')) {
            this.criteria.delete(id);
            this.selectedCriterion = null;
            this.hideInspector();
            this.render();
            this.saveCriteria();
        }
    }
    
    askAIAboutCriterion(id) {
        const criterion = this.criteria.get(id);
        if (!criterion) return;
        
        this.askAI();
        
        setTimeout(() => {
            this.addChatMessage('user', `「${criterion.name}」の評価基準について詳しく教えてください。`);
            this.sendMessage();
        }, 500);
    }
    
    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#A855F7', '#FFD93D', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    saveCriteria() {
        const data = Array.from(this.criteria.values());
        localStorage.setItem('evaluation-criteria', JSON.stringify(data));
    }
    
    addMissingCriteria(categories) {
        // 不足しているカテゴリの基準を追加
        categories.forEach(category => {
            this.addCriterion();
            // 最後に追加された基準のカテゴリを設定
            const lastCriterion = Array.from(this.criteria.values()).pop();
            if (lastCriterion) {
                lastCriterion.category = category;
                lastCriterion.name = `${this.getCategoryLabel(category)}基準`;
            }
        });
        
        this.render();
    }
}

// Initialize evaluation criteria canvas
window.evalCanvas = new EvaluationCriteriaCanvas();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EvaluationCriteriaCanvas;
}