// Agent Creator functionality

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updatePreview();
});

// Initialize event listeners
function initializeEventListeners() {
    // Form submission
    document.getElementById('agent-creator-form').addEventListener('submit', handleFormSubmit);
    
    // Role selection
    document.getElementById('agent-role').addEventListener('change', handleRoleChange);
    
    // Avatar selection
    document.querySelectorAll('.avatar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('agent-avatar').value = e.target.dataset.avatar;
            updatePreview();
        });
    });
    
    // Real-time preview updates
    const previewTriggers = [
        'agent-name',
        'agent-role',
        'agent-avatar',
        'personality-description',
        'communication-style'
    ];
    
    previewTriggers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updatePreview);
            element.addEventListener('change', updatePreview);
        }
    });
    
    // Trait and genre checkboxes
    document.querySelectorAll('input[name="traits"], input[name="genres"]').forEach(checkbox => {
        checkbox.addEventListener('change', updatePreview);
    });
    
    // Creativity level slider
    const creativitySlider = document.getElementById('creativity-level');
    creativitySlider.addEventListener('input', (e) => {
        document.getElementById('creativity-value').textContent = e.target.value;
    });
    
    // Generate prompt button
    document.getElementById('generate-prompt').addEventListener('click', generateSystemPrompt);
    
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Handle role change
function handleRoleChange(e) {
    const customRoleGroup = document.getElementById('custom-role-group');
    if (e.target.value === 'custom') {
        customRoleGroup.style.display = 'block';
    } else {
        customRoleGroup.style.display = 'none';
    }
    updatePreview();
}

// Update preview
function updatePreview() {
    const name = document.getElementById('agent-name').value || 'エージェント名';
    const role = getSelectedRole();
    const avatar = document.getElementById('agent-avatar').value || '🤖';
    const description = generatePreviewDescription();
    
    document.querySelector('.preview-avatar').textContent = avatar;
    document.querySelector('.preview-name').textContent = name;
    document.querySelector('.preview-role').textContent = role;
    document.querySelector('.preview-description').textContent = description;
}

// Get selected role
function getSelectedRole() {
    const role = document.getElementById('agent-role').value;
    if (role === 'custom') {
        return document.getElementById('custom-role').value || 'カスタム役割';
    }
    
    const roleLabels = {
        writer: '執筆者',
        editor: '編集者',
        critic: '批評家',
        researcher: 'リサーチャー',
        consultant: 'コンサルタント'
    };
    
    return roleLabels[role] || '役割未設定';
}

// Generate preview description
function generatePreviewDescription() {
    const traits = Array.from(document.querySelectorAll('input[name="traits"]:checked'))
        .map(cb => getTraitLabel(cb.value));
    
    const communicationStyle = document.getElementById('communication-style').value;
    const personalityDesc = document.getElementById('personality-description').value;
    
    if (personalityDesc) {
        return personalityDesc.substring(0, 100) + (personalityDesc.length > 100 ? '...' : '');
    }
    
    let description = '';
    
    if (traits.length > 0) {
        description += traits.join('、') + 'な性格。';
    }
    
    description += getCommunicationStyleLabel(communicationStyle) + 'コミュニケーションスタイル。';
    
    return description || '性格や特徴を設定してください。';
}

// Get trait label
function getTraitLabel(trait) {
    const labels = {
        analytical: '分析的',
        creative: '創造的',
        critical: '批判的',
        supportive: '協力的',
        'detail-oriented': '詳細志向',
        'big-picture': '全体志向',
        pragmatic: '実践的',
        theoretical: '理論的'
    };
    
    return labels[trait] || trait;
}

// Get communication style label
function getCommunicationStyleLabel(style) {
    const labels = {
        formal: 'フォーマルな',
        casual: 'カジュアルな',
        professional: 'プロフェッショナルな',
        friendly: 'フレンドリーな',
        mentor: 'メンター的な'
    };
    
    return labels[style] || style;
}

// Generate system prompt
function generateSystemPrompt() {
    const name = document.getElementById('agent-name').value || '名無しのエージェント';
    const role = getSelectedRole();
    const traits = Array.from(document.querySelectorAll('input[name="traits"]:checked'))
        .map(cb => getTraitLabel(cb.value));
    const communicationStyle = getCommunicationStyleLabel(document.getElementById('communication-style').value);
    const personalityDesc = document.getElementById('personality-description').value;
    const genres = Array.from(document.querySelectorAll('input[name="genres"]:checked'))
        .map(cb => getGenreLabel(cb.value));
    const expertise = document.getElementById('expertise').value;
    const writingStyle = document.getElementById('writing-style').value;
    const feedbackStyle = document.getElementById('feedback-style').value;
    const responseLength = document.getElementById('response-length').value;
    const creativityLevel = document.getElementById('creativity-level').value;
    
    let prompt = `あなたは「${name}」という名前の${role}です。\n\n`;
    
    // 性格
    if (traits.length > 0) {
        prompt += `性格特性：${traits.join('、')}\n`;
    }
    prompt += `コミュニケーションスタイル：${communicationStyle}\n`;
    
    if (personalityDesc) {
        prompt += `\n詳細な性格設定：\n${personalityDesc}\n`;
    }
    
    // 専門分野
    if (genres.length > 0) {
        prompt += `\n専門ジャンル：${genres.join('、')}\n`;
    }
    
    if (expertise) {
        prompt += `専門知識：${expertise}\n`;
    }
    
    if (writingStyle) {
        prompt += `得意な文体：${writingStyle}\n`;
    }
    
    // 行動パターン
    prompt += `\n行動パターン：\n`;
    prompt += `- フィードバック：${getFeedbackStyleLabel(feedbackStyle)}\n`;
    prompt += `- 返答の長さ：${getResponseLengthLabel(responseLength)}\n`;
    prompt += `- 創造性レベル：${creativityLevel}/100（${creativityLevel < 30 ? '保守的' : creativityLevel > 70 ? '革新的' : 'バランス型'}）\n`;
    
    prompt += `\n小説創作の支援において、上記の特性に従って行動し、作家の創造性を最大限に引き出してください。`;
    
    document.getElementById('system-prompt').value = prompt;
}

// Get genre label
function getGenreLabel(genre) {
    const labels = {
        fantasy: 'ファンタジー',
        sf: 'SF',
        mystery: 'ミステリー',
        romance: '恋愛',
        horror: 'ホラー',
        literary: '純文学',
        historical: '歴史',
        youth: '青春'
    };
    
    return labels[genre] || genre;
}

// Get feedback style label
function getFeedbackStyleLabel(style) {
    const labels = {
        encouraging: '励まし型（ポジティブ重視）',
        balanced: 'バランス型（良い点と改善点）',
        critical: '批評型（改善点重視）',
        coaching: 'コーチング型（質問で導く）'
    };
    
    return labels[style] || style;
}

// Get response length label
function getResponseLengthLabel(length) {
    const labels = {
        concise: '簡潔',
        moderate: '標準',
        detailed: '詳細'
    };
    
    return labels[length] || length;
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate required fields
    const name = document.getElementById('agent-name').value.trim();
    const role = document.getElementById('agent-role').value;
    
    if (!name || !role) {
        showError('必須項目を入力してください');
        return;
    }
    
    // Collect form data
    const agentData = {
        name: name,
        role: role === 'custom' ? document.getElementById('custom-role').value : role,
        avatar: document.getElementById('agent-avatar').value || '🤖',
        traits: Array.from(document.querySelectorAll('input[name="traits"]:checked')).map(cb => cb.value),
        communicationStyle: document.getElementById('communication-style').value,
        personalityDescription: document.getElementById('personality-description').value,
        genres: Array.from(document.querySelectorAll('input[name="genres"]:checked')).map(cb => cb.value),
        expertise: document.getElementById('expertise').value,
        writingStyle: document.getElementById('writing-style').value,
        feedbackStyle: document.getElementById('feedback-style').value,
        responseLength: document.getElementById('response-length').value,
        creativityLevel: parseInt(document.getElementById('creativity-level').value),
        systemPrompt: document.getElementById('system-prompt').value || generateSystemPrompt()
    };
    
    try {
        // Save agent
        const api = window.api || window.mockAPI;
        const response = await api.invoke('agent:create', agentData);
        
        if (response.success) {
            // Show success modal
            document.getElementById('success-modal').style.display = 'flex';
            
            // Store created agent ID for navigation
            localStorage.setItem('lastCreatedAgentId', response.data.id);
        } else {
            showError('エージェントの作成に失敗しました: ' + response.error);
        }
    } catch (error) {
        console.error('Failed to create agent:', error);
        showError('エージェントの作成に失敗しました');
    }
}

// Navigation functions
function goToAgentMeeting() {
    window.location.href = './agent-meeting.html';
}

function createAnother() {
    document.getElementById('success-modal').style.display = 'none';
    document.getElementById('agent-creator-form').reset();
    document.getElementById('agent-avatar').value = '🤖';
    updatePreview();
}

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    switch (page) {
        case 'agent-meeting':
            window.location.href = './agent-meeting.html';
            break;
        case 'projects':
            window.location.href = './projects.html';
            break;
        case 'writing-editor':
            window.location.href = './writing-editor.html';
            break;
        case 'anything-box':
            window.location.href = './anything-box.html';
            break;
        case 'serendipity':
            window.location.href = './serendipity.html';
            break;
        case 'knowledge-graph':
            window.location.href = './knowledge-graph.html';
            break;
        case 'settings':
            window.location.href = './settings.html';
            break;
        default:
            console.log(`Navigation to ${page} not implemented`);
    }
}

// Utility functions
function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    const colors = {
        error: '#f44336',
        success: '#4CAF50',
        info: '#2196F3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.style.color = 'white';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Make functions globally available
window.goToAgentMeeting = goToAgentMeeting;
window.createAnother = createAnother;