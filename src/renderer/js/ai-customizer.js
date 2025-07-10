// AI Customizer functionality

// Global state
let currentAgent = 'writer_sharp';
let currentPersonality = null;
let aiThreadManager = null;
let testHistory = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeCustomizer();
    initializeEventListeners();
    loadAIPersonalities();
});

// Initialize customizer
function initializeCustomizer() {
    // Get agent ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agent');
    
    if (agentId) {
        currentAgent = agentId;
        selectAICard(agentId);
    }
    
    // Initialize AI Thread Manager if available from parent window
    if (window.opener && window.opener.aiThreadManager) {
        aiThreadManager = window.opener.aiThreadManager;
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // AI card selection
    document.querySelectorAll('.ai-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const agentId = e.currentTarget.dataset.agent;
            selectAICard(agentId);
        });
    });
    
    // Trait sliders
    document.querySelectorAll('.trait-slider input[type="range"]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            updateSliderValue(e.target);
            updatePersonalityFromSliders();
        });
    });
    
    // Style selectors
    document.querySelectorAll('#tone, #length-preference, #perspective').forEach(select => {
        select.addEventListener('change', updatePersonalityFromSelectors);
    });
    
    // Prompt tabs
    document.querySelectorAll('.prompt-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchPromptTab(e.target.dataset.tab);
        });
    });
    
    // Role cards
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', (e) => {
            selectRole(e.currentTarget.dataset.role);
        });
    });
    
    // Goal and constraint checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updatePersonalityFromVisual);
    });
    
    // System prompt textarea
    document.getElementById('system-prompt').addEventListener('input', (e) => {
        if (currentPersonality) {
            currentPersonality.systemPrompt = e.target.value;
        }
    });
}

// Select AI card
function selectAICard(agentId) {
    currentAgent = agentId;
    
    // Update UI
    document.querySelectorAll('.ai-card').forEach(card => {
        card.classList.toggle('active', card.dataset.agent === agentId);
    });
    
    // Load personality for this agent
    loadPersonalityForAgent(agentId);
}

// Load AI personalities
async function loadAIPersonalities() {
    try {
        // Get personalities from AI Thread Manager or API
        if (aiThreadManager) {
            currentPersonality = aiThreadManager.getPersonality(currentAgent);
        } else {
            const result = await window.api.invoke('ai:getPersonality', { agentId: currentAgent });
            currentPersonality = result.personality;
        }
        
        updateUIFromPersonality();
        
    } catch (error) {
        console.error('Failed to load AI personalities:', error);
        // Use default personality
        currentPersonality = getDefaultPersonality(currentAgent);
        updateUIFromPersonality();
    }
}

// Load personality for specific agent
function loadPersonalityForAgent(agentId) {
    if (aiThreadManager) {
        currentPersonality = aiThreadManager.getPersonality(agentId);
    } else {
        currentPersonality = getDefaultPersonality(agentId);
    }
    
    updateUIFromPersonality();
    loadMemoryForAgent(agentId);
}

// Update UI from personality data
function updateUIFromPersonality() {
    if (!currentPersonality) return;
    
    // Basic info
    document.getElementById('ai-name').value = currentPersonality.name || '';
    document.getElementById('ai-description').value = currentPersonality.description || '';
    
    // Trait sliders
    const traits = currentPersonality.traits || {};
    updateSlider('creativity', traits.creativity || 70);
    updateSlider('emotion', traits.emotion || 60);
    updateSlider('detail', traits.detail || 50);
    updateSlider('conciseness', traits.conciseness || 80);
    updateSlider('dialogue', traits.dialogue || 70);
    updateSlider('action', traits.action || 60);
    
    // Style selectors
    document.getElementById('tone').value = currentPersonality.tone || 'sharp';
    document.getElementById('length-preference').value = currentPersonality.lengthPreference || 'mixed';
    document.getElementById('perspective').value = currentPersonality.perspective || 'adaptive';
    
    // System prompt
    document.getElementById('system-prompt').value = currentPersonality.systemPrompt || '';
    
    // Visual settings
    updateVisualFromPersonality();
}

// Update slider value display
function updateSlider(id, value) {
    const slider = document.getElementById(id);
    const valueSpan = slider.nextElementSibling;
    
    slider.value = value;
    valueSpan.textContent = `${value}%`;
}

// Update slider value on change
function updateSliderValue(slider) {
    const valueSpan = slider.nextElementSibling;
    valueSpan.textContent = `${slider.value}%`;
}

// Update personality from sliders
function updatePersonalityFromSliders() {
    if (!currentPersonality) return;
    
    if (!currentPersonality.traits) currentPersonality.traits = {};
    
    currentPersonality.traits.creativity = parseInt(document.getElementById('creativity').value);
    currentPersonality.traits.emotion = parseInt(document.getElementById('emotion').value);
    currentPersonality.traits.detail = parseInt(document.getElementById('detail').value);
    currentPersonality.traits.conciseness = parseInt(document.getElementById('conciseness').value);
    currentPersonality.traits.dialogue = parseInt(document.getElementById('dialogue').value);
    currentPersonality.traits.action = parseInt(document.getElementById('action').value);
    
    generateSystemPromptFromVisual();
}

// Update personality from selectors
function updatePersonalityFromSelectors() {
    if (!currentPersonality) return;
    
    currentPersonality.tone = document.getElementById('tone').value;
    currentPersonality.lengthPreference = document.getElementById('length-preference').value;
    currentPersonality.perspective = document.getElementById('perspective').value;
    
    generateSystemPromptFromVisual();
}

// Switch prompt tab
function switchPromptTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.prompt-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.prompt-content').forEach(content => {
        if (content.classList.contains(`${tabName}-mode`)) {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    });
}

// Select role
function selectRole(role) {
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.toggle('active', card.dataset.role === role);
    });
    
    if (currentPersonality) {
        currentPersonality.role = role;
        generateSystemPromptFromVisual();
    }
}

// Update personality from visual settings
function updatePersonalityFromVisual() {
    generateSystemPromptFromVisual();
}

// Update visual settings from personality
function updateVisualFromPersonality() {
    if (!currentPersonality) return;
    
    // Role selection
    if (currentPersonality.role) {
        document.querySelectorAll('.role-card').forEach(card => {
            card.classList.toggle('active', card.dataset.role === currentPersonality.role);
        });
    }
    
    // Goals and constraints
    const goals = currentPersonality.goals || [];
    const constraints = currentPersonality.constraints || [];
    
    document.getElementById('goal-engaging').checked = goals.includes('engaging');
    document.getElementById('goal-natural').checked = goals.includes('natural');
    document.getElementById('goal-emotional').checked = goals.includes('emotional');
    document.getElementById('goal-visual').checked = goals.includes('visual');
    document.getElementById('goal-innovative').checked = goals.includes('innovative');
    
    document.getElementById('no-ai-like').checked = constraints.includes('no-ai-like');
    document.getElementById('no-cliche').checked = constraints.includes('no-cliche');
    document.getElementById('no-verbose').checked = constraints.includes('no-verbose');
    document.getElementById('no-explanation').checked = constraints.includes('no-explanation');
}

// Generate system prompt from visual settings
window.generateFromVisual = function() {
    generateSystemPromptFromVisual();
};

function generateSystemPromptFromVisual() {
    if (!currentPersonality) return;
    
    const name = document.getElementById('ai-name').value || currentPersonality.name;
    const description = document.getElementById('ai-description').value || '';
    const role = currentPersonality.role || 'novelist';
    const traits = currentPersonality.traits || {};
    const tone = currentPersonality.tone || 'sharp';
    
    // Get selected goals
    const goals = [];
    if (document.getElementById('goal-engaging').checked) goals.push('engaging');
    if (document.getElementById('goal-natural').checked) goals.push('natural');
    if (document.getElementById('goal-emotional').checked) goals.push('emotional');
    if (document.getElementById('goal-visual').checked) goals.push('visual');
    if (document.getElementById('goal-innovative').checked) goals.push('innovative');
    
    // Get selected constraints
    const constraints = [];
    if (document.getElementById('no-ai-like').checked) constraints.push('no-ai-like');
    if (document.getElementById('no-cliche').checked) constraints.push('no-cliche');
    if (document.getElementById('no-verbose').checked) constraints.push('no-verbose');
    if (document.getElementById('no-explanation').checked) constraints.push('no-explanation');
    
    // Generate system prompt
    let prompt = `あなたは「${name}」という${getRoleDescription(role)}AIです。\n\n`;
    
    if (description) {
        prompt += `## 特徴\n${description}\n\n`;
    }
    
    prompt += `## 文体特性\n`;
    prompt += `- 創造性: ${traits.creativity || 70}% - ${getCreativityDescription(traits.creativity || 70)}\n`;
    prompt += `- 感情表現: ${traits.emotion || 60}% - ${getEmotionDescription(traits.emotion || 60)}\n`;
    prompt += `- 描写の詳細さ: ${traits.detail || 50}% - ${getDetailDescription(traits.detail || 50)}\n`;
    prompt += `- 文章の簡潔さ: ${traits.conciseness || 80}% - ${getConcisenessDescription(traits.conciseness || 80)}\n`;
    prompt += `- 対話の自然さ: ${traits.dialogue || 70}% - ${getDialogueDescription(traits.dialogue || 70)}\n`;
    prompt += `- アクションの躍動感: ${traits.action || 60}% - ${getActionDescription(traits.action || 60)}\n`;
    prompt += `\n`;
    
    prompt += `## 文体の雰囲気\n${getToneDescription(tone)}\n\n`;
    
    if (goals.length > 0) {
        prompt += `## 目標・使命\n`;
        goals.forEach(goal => {
            prompt += `- ${getGoalDescription(goal)}\n`;
        });
        prompt += `\n`;
    }
    
    if (constraints.length > 0) {
        prompt += `## 禁止事項\n`;
        constraints.forEach(constraint => {
            prompt += `- ${getConstraintDescription(constraint)}\n`;
        });
        prompt += `\n`;
    }
    
    prompt += `あなたの使命は、読者の心に響く${getToneAdjective(tone)}文章を創造することです。`;
    
    // Update system prompt textarea
    document.getElementById('system-prompt').value = prompt;
    currentPersonality.systemPrompt = prompt;
    currentPersonality.goals = goals;
    currentPersonality.constraints = constraints;
}

// Test AI functionality
window.testAI = async function() {
    const testPrompt = document.getElementById('test-prompt').value.trim();
    if (!testPrompt) {
        showError('テスト用の文章を入力してください');
        return;
    }
    
    const resultDiv = document.getElementById('test-result');
    resultDiv.innerHTML = '<p class="loading">AIがテスト中...</p>';
    
    try {
        const result = await window.api.invoke('ai:testCustomPersonality', {
            agentId: currentAgent,
            personality: currentPersonality,
            testPrompt: testPrompt
        });
        
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="test-output">
                    <h5>AI回答:</h5>
                    <p>${escapeHtml(result.response)}</p>
                </div>
                <div class="test-metrics">
                    <span class="metric">レスポンス時間: ${result.responseTime}ms</span>
                    <span class="metric">品質スコア: ${result.qualityScore}/10</span>
                </div>
            `;
            
            // Update performance metrics
            updatePerformanceMetrics(result.metrics);
            
            // Add to test history
            testHistory.push({
                prompt: testPrompt,
                response: result.response,
                timestamp: new Date().toISOString(),
                metrics: result.metrics
            });
            
        } else {
            throw new Error(result.error || 'テストに失敗しました');
        }
        
    } catch (error) {
        console.error('AI test failed:', error);
        resultDiv.innerHTML = `<p class="error-message">エラー: ${error.message}</p>`;
    }
};

// Generate sample
window.generateSample = async function(action) {
    const resultDiv = document.getElementById('sample-result');
    resultDiv.innerHTML = '<p class="loading">サンプルを生成中...</p>';
    
    try {
        const samplePrompts = {
            continue: '主人公は重要な決断を迫られていた。',
            dialogue: '二人のキャラクターが初めて出会うシーン。',
            scene: '夕暮れの街角での情景描写。'
        };
        
        const result = await window.api.invoke('ai:generateSample', {
            agentId: currentAgent,
            personality: currentPersonality,
            action: action,
            prompt: samplePrompts[action]
        });
        
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="sample-output">
                    <h5>${getSampleActionName(action)}サンプル:</h5>
                    <p>${escapeHtml(result.text)}</p>
                </div>
            `;
        } else {
            throw new Error(result.error || 'サンプル生成に失敗しました');
        }
        
    } catch (error) {
        console.error('Sample generation failed:', error);
        resultDiv.innerHTML = `<p class="error-message">エラー: ${error.message}</p>`;
    }
};

// Update performance metrics
function updatePerformanceMetrics(metrics) {
    if (!metrics) return;
    
    updateMetric('creativity-score', metrics.creativity || 0);
    updateMetric('naturalness-score', metrics.naturalness || 0);
    updateMetric('consistency-score', metrics.consistency || 0);
}

function updateMetric(id, value) {
    const fill = document.getElementById(id);
    const valueSpan = fill.parentElement.nextElementSibling;
    
    fill.style.width = `${value}%`;
    valueSpan.textContent = `${Math.round(value)}%`;
}

// Load memory for agent
function loadMemoryForAgent(agentId) {
    const memoryDiv = document.getElementById('memory-display');
    
    if (aiThreadManager) {
        const memory = aiThreadManager.getMemory(agentId);
        
        if (memory.length === 0) {
            memoryDiv.innerHTML = '<p class="empty-state">記憶がまだありません</p>';
        } else {
            memoryDiv.innerHTML = memory.slice(0, 5).map(mem => `
                <div class="memory-item">
                    <div class="memory-content">${escapeHtml(mem.content.substring(0, 100))}...</div>
                    <div class="memory-meta">
                        <span class="memory-time">${new Date(mem.timestamp).toLocaleString('ja-JP')}</span>
                        <span class="memory-importance">重要度: ${Math.round(mem.importance * 100)}%</span>
                    </div>
                </div>
            `).join('');
        }
    } else {
        memoryDiv.innerHTML = '<p class="empty-state">記憶機能は執筆エディタで利用可能です</p>';
    }
}

// Clear memory
window.clearMemory = function() {
    if (!confirm('このAIの記憶をすべてクリアしますか？')) return;
    
    if (aiThreadManager) {
        aiThreadManager.memories.set(currentAgent, []);
        loadMemoryForAgent(currentAgent);
        showSuccess('記憶をクリアしました');
    }
};

// Validate prompt
window.validatePrompt = function() {
    const prompt = document.getElementById('system-prompt').value.trim();
    
    if (!prompt) {
        showError('システムプロンプトを入力してください');
        return;
    }
    
    // Simple validation
    const issues = [];
    
    if (prompt.length < 100) {
        issues.push('プロンプトが短すぎます（推奨: 100文字以上）');
    }
    
    if (!prompt.includes('あなたは') && !prompt.includes('You are')) {
        issues.push('役割定義が不明確です');
    }
    
    if (prompt.includes('AI') && !prompt.includes('AI臭さ')) {
        issues.push('AI臭さへの対策が不十分の可能性があります');
    }
    
    if (issues.length === 0) {
        showSuccess('プロンプトは適切に設定されています');
    } else {
        showInfo('改善提案: ' + issues.join(', '));
    }
};

// Reset to defaults
window.resetToDefaults = function() {
    if (!confirm('デフォルト設定にリセットしますか？')) return;
    
    currentPersonality = getDefaultPersonality(currentAgent);
    updateUIFromPersonality();
    showSuccess('デフォルト設定にリセットしました');
};

// Save customization
window.saveCustomization = function() {
    document.getElementById('save-modal').style.display = 'block';
    document.getElementById('preset-name').value = currentPersonality.name || '';
};

window.closeSaveModal = function() {
    document.getElementById('save-modal').style.display = 'none';
};

window.confirmSave = async function() {
    if (!currentPersonality) return;
    
    // Update personality with current UI values
    currentPersonality.name = document.getElementById('ai-name').value;
    currentPersonality.description = document.getElementById('ai-description').value;
    
    try {
        if (aiThreadManager) {
            aiThreadManager.setPersonality(currentAgent, currentPersonality);
        }
        
        await window.api.invoke('ai:savePersonality', {
            agentId: currentAgent,
            personality: currentPersonality
        });
        
        const saveAsPreset = document.getElementById('save-as-preset').checked;
        if (saveAsPreset) {
            const presetName = document.getElementById('preset-name').value.trim();
            if (presetName) {
                await window.api.invoke('ai:savePreset', {
                    name: presetName,
                    personality: currentPersonality
                });
            }
        }
        
        closeSaveModal();
        showSuccess('カスタマイズを保存しました');
        
        // If opened from writing editor, notify parent
        if (window.opener && window.opener.aiThreadManager) {
            window.opener.aiThreadManager.setPersonality(currentAgent, currentPersonality);
        }
        
    } catch (error) {
        console.error('Failed to save customization:', error);
        showError('保存に失敗しました');
    }
};

// Helper functions
function getDefaultPersonality(agentId) {
    // Same as in writing-editor.js
    const personalities = {
        'writer_sharp': {
            name: 'シャープライター',
            description: 'キレキレの文体を得意とする',
            role: 'novelist',
            tone: 'sharp',
            lengthPreference: 'mixed',
            perspective: 'adaptive',
            traits: {
                creativity: 80,
                emotion: 60,
                detail: 50,
                conciseness: 90,
                dialogue: 70,
                action: 80
            },
            goals: ['engaging', 'natural'],
            constraints: ['no-ai-like', 'no-cliche'],
            systemPrompt: `あなたは「キレキレの文体」を得意とする小説家AIです。

## 特徴
- 鋭利で洗練された文体
- 無駄のない簡潔な表現  
- 読者を引き込む強いフック
- AI臭さを完全に排除した自然な文章

## 文体スタイル
- 短いセンテンスと長いセンテンスを巧みに組み合わせ
- 感情的なインパクトを重視
- 五感に訴える具体的な描写
- 読み手の想像力を刺激する含みのある表現

## 禁止事項
- 説明的すぎる文章
- AIらしい丁寧すぎる表現
- 冗長な修飾語
- ありきたりな比喩や表現

あなたの使命は、読者が思わず次のページをめくりたくなるような、キレキレの文章を生み出すことです。`,
            temperature: 0.8,
            style: 'sharp'
        }
        // Add other personalities...
    };
    
    return personalities[agentId] || personalities['writer_sharp'];
}

function getRoleDescription(role) {
    const descriptions = {
        novelist: '小説家',
        screenwriter: '脚本家',
        poet: '詩人',
        journalist: 'ジャーナリスト'
    };
    return descriptions[role] || '小説家';
}

function getCreativityDescription(value) {
    if (value >= 80) return '非常に創造的で革新的な表現を好む';
    if (value >= 60) return '創造的な表現を取り入れる';
    if (value >= 40) return 'バランスの取れた表現';
    return '堅実で確実な表現を好む';
}

function getEmotionDescription(value) {
    if (value >= 80) return '感情豊かで情緒的な表現';
    if (value >= 60) return '適度な感情表現';
    if (value >= 40) return '控えめな感情表現';
    return '論理的で客観的な表現';
}

function getDetailDescription(value) {
    if (value >= 80) return '非常に詳細で美しい描写';
    if (value >= 60) return '適度に詳細な描写';
    if (value >= 40) return '簡潔ながら要点を押さえた描写';
    return 'ミニマルで簡潔な描写';
}

function getConcisenessDescription(value) {
    if (value >= 80) return '無駄のない簡潔な文章';
    if (value >= 60) return 'やや簡潔な文章';
    if (value >= 40) return 'バランスの取れた長さ';
    return '詳細で丁寧な文章';
}

function getDialogueDescription(value) {
    if (value >= 80) return '非常に自然で生き生きとした対話';
    if (value >= 60) return '自然な対話';
    if (value >= 40) return '適度にリアルな対話';
    return 'フォーマルで正確な対話';
}

function getActionDescription(value) {
    if (value >= 80) return '躍動感あふれるアクション描写';
    if (value >= 60) return '適度に動きのあるアクション';
    if (value >= 40) return 'バランスの取れたアクション描写';
    return '静的で落ち着いたアクション描写';
}

function getToneDescription(tone) {
    const descriptions = {
        sharp: '鋭く洗練された、読者を引き込む強烈な印象を与える文体',
        warm: '温かく親しみやすい、読者との距離を縮める優しい文体',
        cool: 'クールで冷静、知的で落ち着いた印象を与える文体',
        dramatic: 'ドラマチックで感情的、読者の心を大きく揺さぶる文体',
        poetic: '詩的で美しい、芸術性と美的センスを重視した文体',
        realistic: 'リアルで現実的、等身大の人間を描く自然な文体'
    };
    return descriptions[tone] || descriptions['sharp'];
}

function getToneAdjective(tone) {
    const adjectives = {
        sharp: 'キレキレの',
        warm: '温かい',
        cool: 'クールな',
        dramatic: 'ドラマチックな',
        poetic: '美しい',
        realistic: 'リアルな'
    };
    return adjectives[tone] || 'キレキレの';
}

function getGoalDescription(goal) {
    const descriptions = {
        engaging: '読者を魅了し、引き込む文章を書く',
        natural: 'AI臭さを完全に排除し、自然な文章を書く',
        emotional: '読者の感情に深く訴えかける',
        visual: '映像的な美しさと臨場感を追求する',
        innovative: '革新的で独創的な表現を探求する'
    };
    return descriptions[goal] || goal;
}

function getConstraintDescription(constraint) {
    const descriptions = {
        'no-ai-like': 'AIらしい丁寧すぎる表現や機械的な文章を避ける',
        'no-cliche': 'ありきたりな表現や陳腐な比喩を避ける',
        'no-verbose': '冗長で回りくどい文章を避ける',
        'no-explanation': '説明的すぎる文章や解説調を避ける'
    };
    return descriptions[constraint] || constraint;
}

function getSampleActionName(action) {
    const names = {
        continue: '続きを書く',
        dialogue: '対話',
        scene: 'シーン描写'
    };
    return names[action] || action;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    window.api.showMessage(message, 'success');
}

function showError(message) {
    window.api.showMessage(message, 'error');
}

function showInfo(message) {
    window.api.showMessage(message, 'info');
}