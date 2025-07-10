// AI Personality and Evaluation Criteria Link System

class AIPersonalityCriteriaLink {
    constructor() {
        this.personalityManager = null;
        this.criteriaManager = null;
        this.links = new Map(); // personality ID -> criteria ID
        this.init();
    }
    
    init() {
        // 既存のマネージャーを取得
        if (window.personalityCanvas) {
            this.personalityManager = window.personalityCanvas;
        }
        if (window.evaluationCriteriaCanvas) {
            this.criteriaManager = window.evaluationCriteriaCanvas;
        }
        
        this.loadLinks();
    }
    
    // パーソナリティと評価基準をリンク
    linkPersonalityToCriteria(personalityId, criteriaId) {
        this.links.set(personalityId, criteriaId);
        this.saveLinks();
        
        // イベントを発火
        window.dispatchEvent(new CustomEvent('personality-criteria-linked', {
            detail: { personalityId, criteriaId }
        }));
    }
    
    // リンクを解除
    unlinkPersonality(personalityId) {
        this.links.delete(personalityId);
        this.saveLinks();
    }
    
    // パーソナリティのための評価基準を取得
    getCriteriaForPersonality(personalityId) {
        const criteriaId = this.links.get(personalityId);
        if (!criteriaId || !this.criteriaManager) return null;
        
        return this.criteriaManager.criteria.find(c => c.id === criteriaId);
    }
    
    // 評価基準に基づいてテキストを評価
    async evaluateTextWithPersonality(text, personalityId) {
        const criteria = this.getCriteriaForPersonality(personalityId);
        if (!criteria) {
            console.warn('No criteria linked to personality:', personalityId);
            return null;
        }
        
        const personality = this.personalityManager?.personalities.find(p => p.id === personalityId);
        if (!personality) {
            console.warn('Personality not found:', personalityId);
            return null;
        }
        
        // 評価を実行
        const evaluation = await this.performEvaluation(text, personality, criteria);
        return evaluation;
    }
    
    // 実際の評価処理
    async performEvaluation(text, personality, criteria) {
        const weights = criteria.weights;
        const scores = {};
        let totalScore = 0;
        
        // 各評価項目でスコアを計算
        for (const [criterion, weight] of Object.entries(weights)) {
            const score = await this.evaluateCriterion(text, criterion, personality);
            scores[criterion] = score;
            totalScore += score * weight;
        }
        
        return {
            totalScore: Math.round(totalScore),
            scores,
            feedback: this.generateFeedback(scores, criteria, personality),
            suggestions: this.generateSuggestions(scores, criteria, personality)
        };
    }
    
    // 個別の評価項目の評価
    async evaluateCriterion(text, criterion, personality) {
        // Mock evaluation - 実際にはAIを使用
        const mockScores = {
            originality: 70 + Math.random() * 30,
            consistency: 60 + Math.random() * 40,
            emotionalImpact: 50 + Math.random() * 50,
            pacing: 70 + Math.random() * 30,
            characterDepth: 60 + Math.random() * 40,
            worldBuilding: 65 + Math.random() * 35,
            dialogue: 75 + Math.random() * 25,
            plotDevelopment: 70 + Math.random() * 30
        };
        
        // パーソナリティの特性を考慮して調整
        let score = mockScores[criterion] || 70;
        
        // パーソナリティの特性に基づいて評価を調整
        if (personality.traits.critical && personality.traits.critical > 70) {
            score *= 0.9; // より厳しい評価
        }
        if (personality.traits.supportive && personality.traits.supportive > 70) {
            score *= 1.1; // より寛容な評価
        }
        
        return Math.min(100, Math.max(0, score));
    }
    
    // フィードバックを生成
    generateFeedback(scores, criteria, personality) {
        const feedback = [];
        
        // 高得点の項目
        const highScores = Object.entries(scores)
            .filter(([_, score]) => score > 80)
            .map(([criterion, _]) => this.getCriterionLabel(criterion));
        
        if (highScores.length > 0) {
            feedback.push(`${highScores.join('、')}が特に優れています。`);
        }
        
        // 低得点の項目
        const lowScores = Object.entries(scores)
            .filter(([_, score]) => score < 60)
            .map(([criterion, _]) => this.getCriterionLabel(criterion));
        
        if (lowScores.length > 0) {
            feedback.push(`${lowScores.join('、')}に改善の余地があります。`);
        }
        
        // パーソナリティに基づくコメント
        if (personality.style === 'twitter') {
            feedback.push('Twitter小説らしい簡潔さとインパクトを意識しましょう。');
        } else if (personality.style === 'narou') {
            feedback.push('なろう系読者が求める要素を意識した構成になっています。');
        }
        
        return feedback.join(' ');
    }
    
    // 改善提案を生成
    generateSuggestions(scores, criteria, personality) {
        const suggestions = [];
        
        // 最も重要度が高く、スコアが低い項目を特定
        const priorityItems = Object.entries(criteria.weights)
            .filter(([criterion, weight]) => weight > 0.2 && scores[criterion] < 70)
            .sort((a, b) => b[1] - a[1]);
        
        priorityItems.forEach(([criterion, _]) => {
            suggestions.push(this.getSuggestionForCriterion(criterion, personality));
        });
        
        return suggestions.slice(0, 3); // 最大3つの提案
    }
    
    // 評価項目のラベルを取得
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
    
    // 評価項目に対する提案を取得
    getSuggestionForCriterion(criterion, personality) {
        const suggestions = {
            originality: '既存の要素に独自の解釈や新しい視点を加えてみましょう。',
            consistency: '設定やキャラクターの行動に矛盾がないか確認しましょう。',
            emotionalImpact: '読者の感情に訴える描写や展開を増やしてみましょう。',
            pacing: 'シーンの長さや展開のスピードを調整してみましょう。',
            characterDepth: 'キャラクターの内面や背景をもう少し掘り下げてみましょう。',
            worldBuilding: '世界観をより具体的に描写してみましょう。',
            dialogue: '会話をより自然で個性的なものにしてみましょう。',
            plotDevelopment: 'ストーリーの展開にもう少し起伏を加えてみましょう。'
        };
        
        return suggestions[criterion] || '改善の余地があります。';
    }
    
    // リンク設定をUIで表示
    showLinkSettings() {
        const modal = document.createElement('div');
        modal.className = 'personality-criteria-link-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>AIパーソナリティと評価基準の連携</h2>
                <div class="link-settings">
                    ${this.renderLinkSettings()}
                </div>
                <div class="modal-actions">
                    <button onclick="window.personalityCriteriaLink.closeLinkSettings()">閉じる</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    renderLinkSettings() {
        if (!this.personalityManager || !this.criteriaManager) {
            return '<p>パーソナリティまたは評価基準が読み込まれていません。</p>';
        }
        
        const personalities = this.personalityManager.personalities || [];
        const criteria = this.criteriaManager.criteria || [];
        
        return personalities.map(personality => {
            const linkedCriteriaId = this.links.get(personality.id);
            return `
                <div class="link-item">
                    <div class="personality-info">
                        <strong>${personality.name}</strong>
                        <span class="style">[${personality.style}]</span>
                    </div>
                    <select onchange="window.personalityCriteriaLink.updateLink('${personality.id}', this.value)">
                        <option value="">評価基準を選択...</option>
                        ${criteria.map(c => `
                            <option value="${c.id}" ${c.id === linkedCriteriaId ? 'selected' : ''}>
                                ${c.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }).join('');
    }
    
    updateLink(personalityId, criteriaId) {
        if (criteriaId) {
            this.linkPersonalityToCriteria(personalityId, criteriaId);
        } else {
            this.unlinkPersonality(personalityId);
        }
    }
    
    closeLinkSettings() {
        const modal = document.querySelector('.personality-criteria-link-modal');
        if (modal) {
            modal.remove();
        }
    }
    
    // 保存と読み込み
    saveLinks() {
        const data = {
            version: '1.0',
            links: Array.from(this.links.entries()),
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('personality-criteria-links', JSON.stringify(data));
    }
    
    loadLinks() {
        try {
            const saved = localStorage.getItem('personality-criteria-links');
            if (saved) {
                const data = JSON.parse(saved);
                this.links = new Map(data.links);
            }
        } catch (error) {
            console.error('Failed to load personality-criteria links:', error);
        }
    }
}

// Initialize link system
window.personalityCriteriaLink = new AIPersonalityCriteriaLink();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIPersonalityCriteriaLink;
}