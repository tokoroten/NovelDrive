// Projects page JavaScript

let currentProjects = [];
let selectedProjectId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Create project button
    document.getElementById('create-project-btn').addEventListener('click', showCreateProjectModal);
    
    // Create project form
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProject);
    
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Load all projects
async function loadProjects() {
    try {
        const response = await window.api.invoke('project:getAll');
        
        if (response.success) {
            currentProjects = response.data;
            renderProjects();
        } else {
            console.error('Failed to load projects:', response.error);
            showError('プロジェクトの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// Render projects
function renderProjects() {
    const container = document.getElementById('projects-container');
    const emptyState = document.getElementById('empty-state');
    
    if (currentProjects.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    container.innerHTML = currentProjects.map(project => createProjectCard(project)).join('');
    
    // Add create new project card
    container.innerHTML += createEmptyProjectCard();
    
    // Add click handlers
    container.querySelectorAll('.project-card:not(.empty)').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                selectProject(card.dataset.projectId);
            }
        });
    });
    
    container.querySelector('.project-card.empty').addEventListener('click', showCreateProjectModal);
}

// Create project card HTML
function createProjectCard(project) {
    const metadata = project.metadata ? JSON.parse(project.metadata) : {};
    const genre = metadata.genre || 'other';
    const targetLength = metadata.targetLength || 0;
    const currentLength = project.chapter_count * 2000; // Estimate
    const progress = targetLength > 0 ? Math.min(100, (currentLength / targetLength) * 100) : 0;
    
    return `
        <div class="project-card ${selectedProjectId === project.id ? 'active' : ''}" data-project-id="${project.id}">
            <div class="project-header">
                <div>
                    <h3 class="project-title">${escapeHtml(project.name)}</h3>
                    ${genre ? `<span class="project-genre genre-${genre}">${getGenreLabel(genre)}</span>` : ''}
                </div>
            </div>
            
            ${project.description ? `
                <p class="project-description">${escapeHtml(project.description)}</p>
            ` : ''}
            
            <div class="project-stats">
                <div class="stat-item">
                    <span class="stat-label">ナレッジ</span>
                    <span class="stat-value">${project.knowledge_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">キャラクター</span>
                    <span class="stat-value">${project.character_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">プロット</span>
                    <span class="stat-value">${project.plot_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">章</span>
                    <span class="stat-value">${project.chapter_count || 0}</span>
                </div>
            </div>
            
            ${targetLength > 0 ? `
                <div class="project-progress">
                    <div class="progress-info">
                        <span>進捗</span>
                        <span>${Math.floor(progress)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            ` : ''}
            
            <div class="project-actions">
                <button class="secondary-btn" onclick="openProject('${project.id}')">
                    開く
                </button>
                <button class="secondary-btn" onclick="editProject('${project.id}')">
                    編集
                </button>
            </div>
        </div>
    `;
}

// Create empty project card
function createEmptyProjectCard() {
    return `
        <div class="project-card empty">
            <div class="empty-icon">➕</div>
            <div class="empty-text">新規プロジェクト</div>
        </div>
    `;
}

// Show create project modal
function showCreateProjectModal() {
    document.getElementById('create-project-modal').style.display = 'flex';
    document.getElementById('project-name').focus();
}

// Hide create project modal
function hideCreateProjectModal() {
    document.getElementById('create-project-modal').style.display = 'none';
    document.getElementById('create-project-form').reset();
}

// Handle create project form submission
async function handleCreateProject(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const projectData = {
        name: formData.get('name'),
        description: formData.get('description'),
        metadata: {
            genre: formData.get('genre'),
            targetLength: parseInt(formData.get('targetLength')) || 0,
            status: 'planning'
        }
    };
    
    try {
        const response = await window.api.invoke('project:create', projectData);
        
        if (response.success) {
            hideCreateProjectModal();
            await loadProjects();
            showSuccess('プロジェクトを作成しました');
        } else {
            showError(response.error.message || 'プロジェクトの作成に失敗しました');
        }
    } catch (error) {
        console.error('Failed to create project:', error);
        showError('プロジェクトの作成に失敗しました');
    }
}

// Select project
function selectProject(projectId) {
    selectedProjectId = parseInt(projectId);
    
    // Update UI
    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.toggle('active', card.dataset.projectId === projectId);
    });
}

// Open project
function openProject(projectId) {
    // TODO: Navigate to project workspace
    console.log('Opening project:', projectId);
    showInfo('プロジェクトワークスペースは開発中です');
}

// Edit project
function editProject(projectId) {
    // TODO: Show edit modal
    console.log('Editing project:', projectId);
    showInfo('プロジェクト編集機能は開発中です');
}

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    e.currentTarget.closest('.nav-item').classList.add('active');
    
    // TODO: Navigate to different pages
    console.log('Navigating to:', page);
    if (page !== 'projects') {
        showInfo(`${e.currentTarget.querySelector('span:last-child').textContent}は開発中です`);
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getGenreLabel(genre) {
    const labels = {
        fantasy: 'ファンタジー',
        scifi: 'SF',
        mystery: 'ミステリー',
        romance: '恋愛',
        literary: '純文学',
        other: 'その他'
    };
    return labels[genre] || genre;
}

// Notification functions
function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showInfo(message) {
    showNotification(message, 'info');
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

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);