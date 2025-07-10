// Idea Gacha functionality

// Global state
let currentIdea = null;
let gachaHistory = [];
let gachaStats = {
    totalPulls: 0,
    savedIdeas: 0,
    rarePulls: 0,
    comboCount: 0
};

// Idea templates
const ideaTemplates = {
    character: [
        { template: "{職業}の{性格}な{特徴}を持つキャラクター", rarity: "common" },
        { template: "{過去}を背負った{能力}を持つ{役割}", rarity: "uncommon" },
        { template: "{秘密}を抱える{立場}で、{目的}のために行動する人物", rarity: "rare" },
        { template: "{矛盾}を内包した{背景}を持ち、{変化}を求める複雑な人物", rarity: "epic" }
    ],
    plot: [
        { template: "{場所}で{事件}が起こり、{人物}が{行動}する物語", rarity: "common" },
        { template: "{時代}の{世界}で、{対立}を解決するために{方法}を用いる展開", rarity: "uncommon" },
        { template: "{始まり}から{転換点}を経て、{結末}に至る{テーマ}の物語", rarity: "rare" },
        { template: "{象徴}と{現実}が交錯し、{哲学的問い}を投げかける{ジャンル}作品", rarity: "legendary" }
    ],
    world: [
        { template: "{地理}と{文化}が特徴的な{時代}の世界", rarity: "common" },
        { template: "{法則}が支配する{社会}で、{技術}が発達した世界観", rarity: "uncommon" },
        { template: "{歴史}の分岐点から生まれた、{要素}が混在する{規模}の世界", rarity: "rare" }
    ],
    scene: [
        { template: "{時間}の{場所}で{人物}が{感情}を抱くシーン", rarity: "common" },
        { template: "{状況}の中で{対話}が交わされ、{変化}が生まれる場面", rarity: "uncommon" },
        { template: "{象徴的な物}を介して{関係性}が{方向}へ動く印象的なシーン", rarity: "epic" }
    ]
};

// Word pools for random generation
const wordPools = {
    職業: ["医者", "教師", "探偵", "画家", "音楽家", "パイロット", "料理人", "プログラマー", "考古学者", "司書"],
    性格: ["冷静", "情熱的", "皮肉屋", "楽観的", "神経質", "大胆", "慎重", "好奇心旺盛", "頑固", "柔軟"],
    特徴: ["記憶喪失", "特殊能力", "過去の傷", "秘密の使命", "二重人格", "不死身", "予知能力", "変身能力"],
    過去: ["戦争体験", "家族の喪失", "裏切り", "失恋", "成功と転落", "隠された出自", "犯罪歴", "英雄的行為"],
    能力: ["読心術", "時間操作", "幻覚創造", "治癒能力", "予知", "念動力", "変身", "不可視化"],
    場所: ["廃墟", "宇宙船", "地下都市", "浮遊島", "深海基地", "異次元空間", "古代遺跡", "未来都市"],
    事件: ["殺人事件", "誘拐", "爆発", "侵略", "発見", "裏切り", "革命", "災害", "陰謀"],
    時代: ["中世", "近未来", "現代", "古代", "パラレルワールド", "時間ループ", "終末後", "黄金時代"],
    テーマ: ["愛と犠牲", "正義と復讐", "自由と責任", "真実と虚構", "生と死", "光と闇", "秩序と混沌", "希望と絶望"]
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadGachaHistory();
    updateStats();
});

// Initialize event listeners
function initializeEventListeners() {
    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', handleFilterChange);
    });
}

// Pull gacha
window.pullGacha = async function() {
    const button = document.getElementById('gacha-pull');
    const capsule = document.getElementById('gacha-capsule');
    const gachaType = document.querySelector('input[name="gacha-type"]:checked').value;
    
    // Disable button and animate
    button.disabled = true;
    capsule.classList.add('spinning');
    
    try {
        let idea;
        
        switch (gachaType) {
            case 'serendipity':
                idea = await pullSerendipityGacha();
                break;
            case 'combination':
                idea = await pullCombinationGacha();
                break;
            default:
                idea = pullRandomGacha();
        }
        
        currentIdea = idea;
        
        // Update stats
        gachaStats.totalPulls++;
        if (idea.rarity === 'rare' || idea.rarity === 'epic' || idea.rarity === 'legendary') {
            gachaStats.rarePulls++;
        }
        
        // Show result
        setTimeout(() => {
            displayResult(idea);
            addToHistory(idea);
            updateStats();
            
            // Update capsule icon based on rarity
            updateCapsuleIcon(idea.rarity);
            
            capsule.classList.remove('spinning');
            button.disabled = false;
        }, 1000);
        
    } catch (error) {
        console.error('Failed to pull gacha:', error);
        window.api.showMessage('ガチャの実行に失敗しました', 'error');
        capsule.classList.remove('spinning');
        button.disabled = false;
    }
};

// Pull random gacha
function pullRandomGacha() {
    const types = Object.keys(ideaTemplates);
    const type = types[Math.floor(Math.random() * types.length)];
    const templates = ideaTemplates[type];
    
    // Weighted random selection based on rarity
    const weights = { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 };
    const totalWeight = templates.reduce((sum, t) => sum + (weights[t.rarity] || 0), 0);
    
    let random = Math.random() * totalWeight;
    let selectedTemplate = templates[0];
    
    for (const template of templates) {
        random -= weights[template.rarity] || 0;
        if (random <= 0) {
            selectedTemplate = template;
            break;
        }
    }
    
    // Generate idea from template
    const idea = generateFromTemplate(selectedTemplate.template, type);
    
    return {
        type,
        rarity: selectedTemplate.rarity,
        title: generateTitle(type),
        content: idea,
        timestamp: new Date().toISOString()
    };
}

// Pull serendipity gacha
async function pullSerendipityGacha() {
    try {
        // Get random items from knowledge base
        const result = await window.api.invoke('serendipity:search', {
            query: getRandomWord(),
            limit: 3,
            options: { includeEmbeddings: false }
        });
        
        if (result.success && result.data.length > 0) {
            // Combine insights from multiple items
            const insights = result.data.map(item => item.title || item.content.substring(0, 50));
            const combined = insights.join('、');
            
            return {
                type: 'serendipity',
                rarity: 'rare',
                title: 'セレンディピティの発見',
                content: `以下の要素から着想を得たアイデア: ${combined}`,
                source: insights,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error('Serendipity search failed:', error);
    }
    
    // Fallback to random
    return pullRandomGacha();
}

// Pull combination gacha
async function pullCombinationGacha() {
    // Get two random ideas and combine them
    const idea1 = pullRandomGacha();
    const idea2 = pullRandomGacha();
    
    return {
        type: 'combination',
        rarity: 'epic',
        title: '組み合わせアイデア',
        content: `【要素1】${idea1.content}\n【要素2】${idea2.content}\n【融合】この2つを組み合わせた新しい物語の可能性`,
        sources: [idea1, idea2],
        timestamp: new Date().toISOString()
    };
}

// Generate from template
function generateFromTemplate(template, type) {
    let result = template;
    const placeholders = template.match(/{([^}]+)}/g);
    
    if (placeholders) {
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(1, -1);
            const pool = wordPools[key];
            
            if (pool) {
                const randomWord = pool[Math.floor(Math.random() * pool.length)];
                result = result.replace(placeholder, randomWord);
            }
        });
    }
    
    return result;
}

// Generate title
function generateTitle(type) {
    const titles = {
        character: ["新キャラクター案", "人物設定", "登場人物アイデア"],
        plot: ["プロット案", "ストーリーアイデア", "展開案"],
        world: ["世界設定案", "舞台設定", "背景世界"],
        scene: ["シーン案", "場面アイデア", "印象的な一幕"]
    };
    
    const typeTitles = titles[type] || ["アイデア"];
    return typeTitles[Math.floor(Math.random() * typeTitles.length)];
}

// Get random word
function getRandomWord() {
    const allWords = Object.values(wordPools).flat();
    return allWords[Math.floor(Math.random() * allWords.length)];
}

// Display result
function displayResult(idea) {
    document.getElementById('result-title').textContent = idea.title;
    document.getElementById('result-content').textContent = idea.content;
    document.getElementById('result-type').textContent = getTypeLabel(idea.type);
    document.getElementById('result-date').textContent = new Date(idea.timestamp).toLocaleString('ja-JP');
    
    const rarityElement = document.getElementById('result-rarity');
    rarityElement.textContent = getRarityLabel(idea.rarity);
    rarityElement.className = `result-rarity ${idea.rarity}`;
    
    document.getElementById('result-area').style.display = 'block';
}

// Update capsule icon
function updateCapsuleIcon(rarity) {
    const icons = {
        common: '💡',
        uncommon: '✨',
        rare: '🌟',
        epic: '💎',
        legendary: '👑'
    };
    
    document.querySelector('.capsule-icon').textContent = icons[rarity] || '?';
}

// Add to history
function addToHistory(idea) {
    gachaHistory.unshift(idea);
    if (gachaHistory.length > 100) {
        gachaHistory = gachaHistory.slice(0, 100);
    }
    saveGachaHistory();
    displayHistory();
}

// Display history
function displayHistory(filter = 'all') {
    const grid = document.getElementById('history-grid');
    const filtered = filter === 'all' 
        ? gachaHistory 
        : gachaHistory.filter(item => item.type === filter);
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="empty-state">履歴がありません</p>';
        return;
    }
    
    grid.innerHTML = filtered.map((item, index) => `
        <div class="history-item" onclick="showHistoryItem(${gachaHistory.indexOf(item)})">
            <div class="history-item-header">
                <div class="history-item-title">${escapeHtml(item.title)}</div>
                <div class="history-item-rarity ${item.rarity}">${getRarityLabel(item.rarity)}</div>
            </div>
            <div class="history-item-content">${escapeHtml(item.content)}</div>
            <div class="history-item-date">${new Date(item.timestamp).toLocaleString('ja-JP')}</div>
        </div>
    `).join('');
}

// Show history item
window.showHistoryItem = function(index) {
    const idea = gachaHistory[index];
    if (idea) {
        currentIdea = idea;
        displayResult(idea);
    }
};

// Handle filter change
function handleFilterChange(event) {
    const chip = event.currentTarget;
    const filter = chip.dataset.filter;
    
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    displayHistory(filter);
}

// Save idea
window.saveIdea = async function() {
    if (!currentIdea) return;
    
    try {
        // Save to inspiration box or project knowledge
        const result = await window.api.invoke('inspiration:create', {
            type: 'idea',
            content: currentIdea.content,
            metadata: {
                title: currentIdea.title,
                ideaType: currentIdea.type,
                rarity: currentIdea.rarity,
                source: 'idea_gacha'
            }
        });
        
        if (result.success) {
            gachaStats.savedIdeas++;
            updateStats();
            saveGachaHistory();
            window.api.showMessage('アイデアを保存しました', 'success');
        }
    } catch (error) {
        console.error('Failed to save idea:', error);
        window.api.showMessage('保存に失敗しました', 'error');
    }
};

// Expand idea
window.expandIdea = function() {
    if (!currentIdea) return;
    document.getElementById('expand-modal').style.display = 'flex';
    document.getElementById('expand-result').style.display = 'none';
};

// Expand with AI
window.expandWithAI = async function(mode) {
    if (!currentIdea) return;
    
    const expandContent = document.getElementById('expand-content');
    expandContent.textContent = '展開中...';
    document.getElementById('expand-result').style.display = 'block';
    
    try {
        // This would call AI API to expand the idea
        // For now, show a placeholder
        let expanded = '';
        
        switch (mode) {
            case 'deeper':
                expanded = `【深掘り展開】\n${currentIdea.content}\n\nこのアイデアをさらに詳細に展開すると...`;
                break;
            case 'variation':
                expanded = `【バリエーション】\n元のアイデア: ${currentIdea.content}\n\nバリエーション1: ...\nバリエーション2: ...\nバリエーション3: ...`;
                break;
            case 'opposite':
                expanded = `【反転アプローチ】\n元のアイデア: ${currentIdea.content}\n\n逆のアプローチ: ...`;
                break;
            case 'combine':
                expanded = `【組み合わせ】\n元のアイデア: ${currentIdea.content}\n\n他の要素との組み合わせ: ...`;
                break;
        }
        
        expandContent.textContent = expanded;
        
    } catch (error) {
        console.error('Failed to expand idea:', error);
        expandContent.textContent = '展開に失敗しました';
    }
};

// Share idea
window.shareIdea = async function() {
    if (!currentIdea) return;
    
    // Load projects
    try {
        const apiInstance = window.api || window.mockAPI;
        const response = await apiInstance.invoke('project:getAll');
        const projects = window.mockAPI && response.data ? response.data : response;
        const selector = document.getElementById('target-project');
        
        selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
        
        document.getElementById('project-select-modal').style.display = 'flex';
    } catch (error) {
        console.error('Failed to load projects:', error);
        window.api.showMessage('プロジェクトの読み込みに失敗しました', 'error');
    }
};

// Send to project
window.sendToProject = async function() {
    const projectId = document.getElementById('target-project').value;
    const category = document.getElementById('idea-category').value;
    const note = document.getElementById('idea-note').value;
    
    if (!projectId) {
        window.api.showMessage('プロジェクトを選択してください', 'warning');
        return;
    }
    
    try {
        // Save to project knowledge or inspiration
        const result = await window.api.invoke('knowledge:create', {
            projectId: parseInt(projectId),
            title: currentIdea.title,
            content: currentIdea.content,
            category: category,
            tags: ['idea_gacha', currentIdea.type, currentIdea.rarity],
            metadata: {
                source: 'idea_gacha',
                note: note,
                originalIdea: currentIdea
            }
        });
        
        if (result.success) {
            window.api.showMessage('プロジェクトに送信しました', 'success');
            closeProjectModal();
        }
    } catch (error) {
        console.error('Failed to send to project:', error);
        window.api.showMessage('送信に失敗しました', 'error');
    }
};

// Clear history
window.clearHistory = function() {
    if (!confirm('履歴をすべて削除しますか？')) return;
    
    gachaHistory = [];
    saveGachaHistory();
    displayHistory();
    window.api.showMessage('履歴をクリアしました', 'success');
};

// Update stats
function updateStats() {
    document.getElementById('total-pulls').textContent = gachaStats.totalPulls;
    document.getElementById('saved-ideas').textContent = gachaStats.savedIdeas;
    document.getElementById('rare-pulls').textContent = gachaStats.rarePulls;
    document.getElementById('combo-count').textContent = gachaStats.comboCount;
}

// Save/Load gacha history
function saveGachaHistory() {
    localStorage.setItem('gachaHistory', JSON.stringify(gachaHistory));
    localStorage.setItem('gachaStats', JSON.stringify(gachaStats));
}

function loadGachaHistory() {
    const savedHistory = localStorage.getItem('gachaHistory');
    const savedStats = localStorage.getItem('gachaStats');
    
    if (savedHistory) {
        gachaHistory = JSON.parse(savedHistory);
        displayHistory();
    }
    
    if (savedStats) {
        gachaStats = JSON.parse(savedStats);
    }
}

// Modal functions
window.closeExpandModal = function() {
    document.getElementById('expand-modal').style.display = 'none';
};

window.closeProjectModal = function() {
    document.getElementById('project-select-modal').style.display = 'none';
};

// Utility functions
function getTypeLabel(type) {
    const labels = {
        character: 'キャラクター',
        plot: 'プロット',
        world: '世界設定',
        scene: 'シーン',
        serendipity: 'セレンディピティ',
        combination: '組み合わせ'
    };
    return labels[type] || type;
}

function getRarityLabel(rarity) {
    const labels = {
        common: 'コモン',
        uncommon: 'アンコモン',
        rare: 'レア',
        epic: 'エピック',
        legendary: 'レジェンダリー'
    };
    return labels[rarity] || rarity;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}