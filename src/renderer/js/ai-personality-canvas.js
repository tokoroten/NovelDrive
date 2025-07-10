// AI Personality Canvas - キャンバス的AIカスタマイズ機能

class AIPersonalityCanvas {
    constructor() {
        this.api = window.api || window.mockAPI;
        this.canvas = null;
        this.ctx = null;
        this.personalities = new Map();
        this.connections = [];
        this.selectedPersonality = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // デフォルトの人格
        this.defaultPersonalities = [
            {
                id: 'writer_sharp',
                name: 'シャープライター',
                type: 'writer',
                position: { x: 200, y: 200 },
                traits: {
                    creativity: 90,
                    emotion: 40,
                    logic: 85,
                    terseness: 95,
                    uniqueness: 90
                },
                color: '#FF6B6B',
                description: 'キレのある文体でAI臭さを消す'
            },
            {
                id: 'editor_twitter',
                name: 'Twitter小説編集者',
                type: 'editor',
                position: { x: 400, y: 150 },
                traits: {
                    creativity: 70,
                    emotion: 60,
                    logic: 90,
                    terseness: 100,
                    uniqueness: 85
                },
                color: '#1DA1F2',
                description: '140字の世界で物語を紡ぐ専門家'
            },
            {
                id: 'editor_narou',
                name: 'なろう系編集者',
                type: 'editor',
                position: { x: 600, y: 200 },
                traits: {
                    creativity: 80,
                    emotion: 70,
                    logic: 75,
                    terseness: 50,
                    uniqueness: 60
                },
                color: '#4ECDC4',
                description: 'Web小説の王道を知り尽くしたプロ'
            },
            {
                id: 'deputy_creative',
                name: '創造的副編集長',
                type: 'deputy',
                position: { x: 400, y: 350 },
                traits: {
                    creativity: 95,
                    emotion: 80,
                    logic: 70,
                    terseness: 60,
                    uniqueness: 95
                },
                color: '#A855F7',
                description: '型破りなアイデアで新境地を開く'
            }
        ];
        
        this.initializeCanvas();
        this.loadPersonalities();
    }
    
    initializeCanvas() {
        // キャンバスを作成
        this.createCanvasUI();
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // 初期描画
        this.render();
    }
    
    createCanvasUI() {
        const container = document.createElement('div');
        container.id = 'ai-personality-canvas-container';
        container.innerHTML = `
            <div class="canvas-header">
                <h2>AIパーソナリティキャンバス</h2>
                <div class="canvas-tools">
                    <button onclick="window.aiCanvas.addPersonality()">
                        <span class="icon">➕</span> 新規作成
                    </button>
                    <button onclick="window.aiCanvas.autoConnect()">
                        <span class="icon">🔗</span> 自動接続
                    </button>
                    <button onclick="window.aiCanvas.saveLayout()">
                        <span class="icon">💾</span> 保存
                    </button>
                    <button onclick="window.aiCanvas.resetLayout()">
                        <span class="icon">🔄</span> リセット
                    </button>
                </div>
            </div>
            <div class="canvas-workspace">
                <canvas id="ai-personality-canvas" width="1000" height="600"></canvas>
                <div class="personality-inspector" id="personality-inspector" style="display: none;">
                    <h3>パーソナリティ詳細</h3>
                    <div class="inspector-content"></div>
                </div>
            </div>
            <div class="canvas-legend">
                <div class="legend-item">
                    <span class="legend-color" style="background: #FF6B6B"></span>
                    <span>ライター</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #4ECDC4"></span>
                    <span>編集者</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #A855F7"></span>
                    <span>副編集長</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #FFD93D"></span>
                    <span>校正者</span>
                </div>
            </div>
        `;
        
        // モーダルとして表示する場合
        if (document.getElementById('ai-canvas-modal')) {
            document.getElementById('ai-canvas-modal-content').appendChild(container);
        } else {
            // スタンドアロンページとして表示
            document.body.appendChild(container);
        }
        
        this.canvas = document.getElementById('ai-personality-canvas');
        this.ctx = this.canvas.getContext('2d');
    }
    
    setupEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // タッチイベント（タブレット対応）
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // ホイールイベント（ズーム）
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    }
    
    loadPersonalities() {
        // デフォルトの人格を追加
        this.defaultPersonalities.forEach(p => {
            this.personalities.set(p.id, p);
        });
        
        // 保存された人格を読み込み
        this.loadSavedPersonalities();
        
        // 接続を自動生成
        this.generateDefaultConnections();
    }
    
    render() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // グリッドを描画
        this.drawGrid();
        
        // 接続線を描画
        this.drawConnections();
        
        // 人格ノードを描画
        this.drawPersonalities();
        
        // 選択中の人格をハイライト
        if (this.selectedPersonality) {
            this.highlightPersonality(this.selectedPersonality);
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#E5E7EB';
        this.ctx.lineWidth = 1;
        
        // 縦線
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 横線
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawConnections() {
        this.connections.forEach(conn => {
            const from = this.personalities.get(conn.from);
            const to = this.personalities.get(conn.to);
            
            if (!from || !to) return;
            
            // ベジェ曲線で接続線を描画
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#9CA3AF';
            this.ctx.lineWidth = 2;
            
            const cp1x = from.position.x + (to.position.x - from.position.x) * 0.5;
            const cp1y = from.position.y;
            const cp2x = from.position.x + (to.position.x - from.position.x) * 0.5;
            const cp2y = to.position.y;
            
            this.ctx.moveTo(from.position.x, from.position.y);
            this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.position.x, to.position.y);
            this.ctx.stroke();
            
            // 関係性の強さを表示
            if (conn.strength) {
                const midX = (from.position.x + to.position.x) / 2;
                const midY = (from.position.y + to.position.y) / 2;
                
                this.ctx.fillStyle = '#6B7280';
                this.ctx.font = '12px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`${Math.round(conn.strength * 100)}%`, midX, midY - 5);
            }
        });
    }
    
    drawPersonalities() {
        this.personalities.forEach(personality => {
            const { position, color, name, traits } = personality;
            
            // ノードを描画
            this.ctx.beginPath();
            this.ctx.arc(position.x, position.y, 40, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#374151';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // 名前を描画
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(name, position.x, position.y);
            
            // トレイトインジケーター
            this.drawTraitIndicators(position, traits);
        });
    }
    
    drawTraitIndicators(position, traits) {
        const radius = 45;
        const indicators = [
            { trait: 'creativity', angle: 0, color: '#FF6B6B' },
            { trait: 'emotion', angle: 72, color: '#4ECDC4' },
            { trait: 'logic', angle: 144, color: '#FFD93D' },
            { trait: 'terseness', angle: 216, color: '#A855F7' },
            { trait: 'uniqueness', angle: 288, color: '#3B82F6' }
        ];
        
        indicators.forEach(({ trait, angle, color }) => {
            const value = traits[trait] || 0;
            const rad = (angle - 90) * Math.PI / 180;
            const x = position.x + Math.cos(rad) * radius;
            const y = position.y + Math.sin(rad) * radius;
            
            // インジケーターを描画
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5 + (value / 20), 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = value / 100;
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        });
    }
    
    highlightPersonality(personality) {
        const { position } = personality;
        
        this.ctx.strokeStyle = '#3B82F6';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, 45, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // クリックされた人格を検索
        const clicked = this.findPersonalityAt(x, y);
        
        if (clicked) {
            this.selectedPersonality = clicked;
            this.isDragging = true;
            this.dragOffset = {
                x: x - clicked.position.x,
                y: y - clicked.position.y
            };
            
            // インスペクターを更新
            this.updateInspector(clicked);
        } else {
            this.selectedPersonality = null;
            this.hideInspector();
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        if (!this.isDragging || !this.selectedPersonality) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 人格の位置を更新
        this.selectedPersonality.position = {
            x: x - this.dragOffset.x,
            y: y - this.dragOffset.y
        };
        
        // グリッドにスナップ
        this.selectedPersonality.position.x = Math.round(this.selectedPersonality.position.x / 25) * 25;
        this.selectedPersonality.position.y = Math.round(this.selectedPersonality.position.y / 25) * 25;
        
        this.render();
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        
        if (this.selectedPersonality) {
            this.savePersonality(this.selectedPersonality);
        }
    }
    
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const personality = this.findPersonalityAt(x, y);
        
        if (personality) {
            this.editPersonality(personality);
        } else {
            this.addPersonalityAt(x, y);
        }
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    handleWheel(e) {
        e.preventDefault();
        // ズーム機能（将来の実装用）
    }
    
    findPersonalityAt(x, y) {
        for (const [id, personality] of this.personalities) {
            const dist = Math.sqrt(
                Math.pow(x - personality.position.x, 2) +
                Math.pow(y - personality.position.y, 2)
            );
            
            if (dist <= 40) {
                return personality;
            }
        }
        return null;
    }
    
    updateInspector(personality) {
        const inspector = document.getElementById('personality-inspector');
        const content = inspector.querySelector('.inspector-content');
        
        content.innerHTML = `
            <div class="inspector-field">
                <label>名前:</label>
                <input type="text" value="${personality.name}" onchange="window.aiCanvas.updatePersonalityName('${personality.id}', this.value)">
            </div>
            <div class="inspector-field">
                <label>説明:</label>
                <textarea onchange="window.aiCanvas.updatePersonalityDescription('${personality.id}', this.value)">${personality.description || ''}</textarea>
            </div>
            <div class="inspector-traits">
                <h4>特性値</h4>
                ${Object.entries(personality.traits).map(([trait, value]) => `
                    <div class="trait-control">
                        <label>${this.getTraitLabel(trait)}:</label>
                        <input type="range" min="0" max="100" value="${value}" 
                               onchange="window.aiCanvas.updateTrait('${personality.id}', '${trait}', this.value)">
                        <span>${value}%</span>
                    </div>
                `).join('')}
            </div>
            <div class="inspector-actions">
                <button onclick="window.aiCanvas.duplicatePersonality('${personality.id}')">複製</button>
                <button onclick="window.aiCanvas.deletePersonality('${personality.id}')" class="danger">削除</button>
            </div>
        `;
        
        inspector.style.display = 'block';
    }
    
    hideInspector() {
        document.getElementById('personality-inspector').style.display = 'none';
    }
    
    getTraitLabel(trait) {
        const labels = {
            creativity: '創造性',
            emotion: '感情表現',
            logic: '論理性',
            terseness: '簡潔さ',
            uniqueness: '独自性'
        };
        return labels[trait] || trait;
    }
    
    addPersonality() {
        const id = `custom_${Date.now()}`;
        const personality = {
            id,
            name: '新しい人格',
            type: 'custom',
            position: { x: 500, y: 300 },
            traits: {
                creativity: 50,
                emotion: 50,
                logic: 50,
                terseness: 50,
                uniqueness: 50
            },
            color: this.getRandomColor(),
            description: 'カスタム人格'
        };
        
        this.personalities.set(id, personality);
        this.selectedPersonality = personality;
        this.render();
        this.updateInspector(personality);
    }
    
    addPersonalityAt(x, y) {
        const id = `custom_${Date.now()}`;
        const personality = {
            id,
            name: '新しい人格',
            type: 'custom',
            position: { x, y },
            traits: {
                creativity: 50,
                emotion: 50,
                logic: 50,
                terseness: 50,
                uniqueness: 50
            },
            color: this.getRandomColor(),
            description: 'カスタム人格'
        };
        
        this.personalities.set(id, personality);
        this.selectedPersonality = personality;
        this.render();
        this.updateInspector(personality);
    }
    
    editPersonality(personality) {
        this.selectedPersonality = personality;
        this.updateInspector(personality);
    }
    
    updatePersonalityName(id, name) {
        const personality = this.personalities.get(id);
        if (personality) {
            personality.name = name;
            this.render();
            this.savePersonality(personality);
        }
    }
    
    updatePersonalityDescription(id, description) {
        const personality = this.personalities.get(id);
        if (personality) {
            personality.description = description;
            this.savePersonality(personality);
        }
    }
    
    updateTrait(id, trait, value) {
        const personality = this.personalities.get(id);
        if (personality) {
            personality.traits[trait] = parseInt(value);
            this.render();
            this.savePersonality(personality);
        }
    }
    
    duplicatePersonality(id) {
        const original = this.personalities.get(id);
        if (!original) return;
        
        const newId = `custom_${Date.now()}`;
        const duplicate = {
            ...original,
            id: newId,
            name: `${original.name} (コピー)`,
            position: {
                x: original.position.x + 50,
                y: original.position.y + 50
            }
        };
        
        this.personalities.set(newId, duplicate);
        this.selectedPersonality = duplicate;
        this.render();
        this.updateInspector(duplicate);
    }
    
    deletePersonality(id) {
        // デフォルトの人格は削除不可
        const personality = this.personalities.get(id);
        if (!personality || personality.type !== 'custom') {
            alert('デフォルトの人格は削除できません');
            return;
        }
        
        if (confirm(`「${personality.name}」を削除しますか？`)) {
            this.personalities.delete(id);
            
            // 関連する接続も削除
            this.connections = this.connections.filter(
                conn => conn.from !== id && conn.to !== id
            );
            
            this.selectedPersonality = null;
            this.hideInspector();
            this.render();
            this.saveLayout();
        }
    }
    
    autoConnect() {
        this.connections = [];
        
        // 人格間の相性を計算して接続を生成
        const personalities = Array.from(this.personalities.values());
        
        for (let i = 0; i < personalities.length; i++) {
            for (let j = i + 1; j < personalities.length; j++) {
                const p1 = personalities[i];
                const p2 = personalities[j];
                
                const compatibility = this.calculateCompatibility(p1, p2);
                
                if (compatibility > 0.5) {
                    this.connections.push({
                        from: p1.id,
                        to: p2.id,
                        strength: compatibility
                    });
                }
            }
        }
        
        this.render();
        this.saveLayout();
    }
    
    calculateCompatibility(p1, p2) {
        // トレイトの差異から相性を計算
        let totalDiff = 0;
        let count = 0;
        
        Object.keys(p1.traits).forEach(trait => {
            if (p2.traits[trait] !== undefined) {
                const diff = Math.abs(p1.traits[trait] - p2.traits[trait]);
                // 適度な差異が良い相性を生む
                const optimalDiff = 30;
                const score = 1 - Math.abs(diff - optimalDiff) / 100;
                totalDiff += score;
                count++;
            }
        });
        
        return count > 0 ? totalDiff / count : 0;
    }
    
    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#A855F7', '#FFD93D', '#3B82F6', '#10B981', '#F59E0B'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    generateDefaultConnections() {
        // デフォルトの接続を生成
        this.connections = [
            { from: 'writer_sharp', to: 'editor_twitter', strength: 0.8 },
            { from: 'writer_sharp', to: 'editor_narou', strength: 0.6 },
            { from: 'editor_twitter', to: 'deputy_creative', strength: 0.7 },
            { from: 'editor_narou', to: 'deputy_creative', strength: 0.75 }
        ];
    }
    
    saveLayout() {
        const layout = {
            personalities: Array.from(this.personalities.entries()),
            connections: this.connections
        };
        
        localStorage.setItem('ai-personality-canvas-layout', JSON.stringify(layout));
    }
    
    loadSavedPersonalities() {
        try {
            const saved = localStorage.getItem('ai-personality-canvas-layout');
            if (saved) {
                const layout = JSON.parse(saved);
                
                // カスタム人格のみを追加（デフォルトは保持）
                layout.personalities.forEach(([id, personality]) => {
                    if (personality.type === 'custom') {
                        this.personalities.set(id, personality);
                    }
                });
                
                this.connections = layout.connections || [];
            }
        } catch (error) {
            console.error('Failed to load saved personalities:', error);
        }
    }
    
    resetLayout() {
        if (confirm('レイアウトをリセットしますか？カスタム人格は削除されます。')) {
            // カスタム人格を削除
            const customIds = Array.from(this.personalities.keys())
                .filter(id => this.personalities.get(id).type === 'custom');
            
            customIds.forEach(id => this.personalities.delete(id));
            
            // デフォルトの接続を復元
            this.generateDefaultConnections();
            
            this.selectedPersonality = null;
            this.hideInspector();
            this.render();
            this.saveLayout();
        }
    }
    
    savePersonality(personality) {
        // 個別の人格を保存
        this.saveLayout();
    }
    
    exportPersonality(id) {
        const personality = this.personalities.get(id);
        if (!personality) return;
        
        const data = JSON.stringify(personality, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${personality.name.replace(/\s+/g, '_')}_personality.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    importPersonality(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const personality = JSON.parse(e.target.result);
                
                // 新しいIDを生成
                personality.id = `imported_${Date.now()}`;
                personality.type = 'custom';
                
                this.personalities.set(personality.id, personality);
                this.selectedPersonality = personality;
                this.render();
                this.updateInspector(personality);
                this.saveLayout();
            } catch (error) {
                alert('人格データの読み込みに失敗しました');
                console.error('Import error:', error);
            }
        };
        
        reader.readAsText(file);
    }
}

// Initialize canvas
window.aiCanvas = new AIPersonalityCanvas();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIPersonalityCanvas;
}