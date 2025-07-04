// Analytics functionality

// Global state
let currentPeriod = 'month';
let currentProject = 'all';
let charts = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadProjects();
    loadAnalyticsData();
    initializeCharts();
});

// Initialize event listeners
function initializeEventListeners() {
    // Period filter
    document.getElementById('period-filter').addEventListener('change', handlePeriodChange);
    
    // Project filter
    document.getElementById('project-filter').addEventListener('change', handleProjectChange);
    
    // Chart tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', handleChartTabChange);
    });
}

// Load projects
async function loadProjects() {
    try {
        const projects = await window.api.invoke('project:list');
        const selector = document.getElementById('project-filter');
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
        
        // Also populate goal project selector
        const goalSelector = document.getElementById('goal-project');
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            goalSelector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// Load analytics data
async function loadAnalyticsData() {
    try {
        const result = await window.api.invoke('analytics:getData', {
            period: currentPeriod,
            projectId: currentProject === 'all' ? null : currentProject
        });
        
        if (result.success) {
            updateSummaryCards(result.data.summary);
            updateCharts(result.data);
            updateHeatmap(result.data.heatmap);
            updateAIStats(result.data.aiStats);
            updateSessionHistory(result.data.sessions);
            updateGoals(result.data.goals);
        }
    } catch (error) {
        console.error('Failed to load analytics data:', error);
        // Use mock data for display
        loadMockData();
    }
}

// Initialize charts
function initializeCharts() {
    // Writing trend chart
    const trendCtx = document.getElementById('writing-trend-chart').getContext('2d');
    charts.trend = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '文字数',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Project stats chart
    const projectCtx = document.getElementById('project-stats-chart').getContext('2d');
    charts.project = new Chart(projectCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Update summary cards
function updateSummaryCards(summary) {
    document.getElementById('total-words').textContent = formatNumber(summary.totalWords);
    document.getElementById('writing-days').textContent = summary.writingDays;
    document.getElementById('total-time').textContent = formatTime(summary.totalTime);
    document.getElementById('daily-average').textContent = formatNumber(summary.dailyAverage);
}

// Update charts
function updateCharts(data) {
    // Update trend chart
    charts.trend.data.labels = data.trend.labels;
    charts.trend.data.datasets[0].data = data.trend.values;
    charts.trend.update();
    
    // Update project chart
    charts.project.data.labels = data.projects.map(p => p.name);
    charts.project.data.datasets[0].data = data.projects.map(p => p.words);
    charts.project.update();
}

// Update heatmap
function updateHeatmap(heatmapData) {
    const container = document.getElementById('writing-heatmap');
    container.innerHTML = '';
    
    // Create heatmap cells
    const weeks = 52; // Show last 52 weeks
    const days = 7;
    
    for (let week = 0; week < weeks; week++) {
        for (let day = 0; day < days; day++) {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            
            const date = new Date();
            date.setDate(date.getDate() - ((weeks - week - 1) * 7 + (6 - day)));
            const dateStr = date.toISOString().split('T')[0];
            
            const data = heatmapData[dateStr] || { level: 0, words: 0 };
            cell.dataset.level = data.level;
            cell.title = `${dateStr}: ${data.words}文字`;
            
            container.appendChild(cell);
        }
    }
}

// Update AI stats
function updateAIStats(stats) {
    const container = document.querySelector('.ai-stats');
    container.innerHTML = '';
    
    const features = [
        { label: 'エージェント会議', key: 'agentMeetings' },
        { label: '執筆支援', key: 'writingAssist' },
        { label: 'セレンディピティ検索', key: 'serendipitySearch' },
        { label: 'アイデアガチャ', key: 'ideaGacha' }
    ];
    
    const maxValue = Math.max(...features.map(f => stats[f.key] || 0));
    
    features.forEach(feature => {
        const value = stats[feature.key] || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        
        container.innerHTML += `
            <div class="ai-stat-item">
                <div class="ai-stat-bar">
                    <div class="ai-stat-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="ai-stat-info">
                    <span class="ai-stat-label">${feature.label}</span>
                    <span class="ai-stat-value">${value}回</span>
                </div>
            </div>
        `;
    });
}

// Update session history
function updateSessionHistory(sessions) {
    const tbody = document.getElementById('session-history');
    tbody.innerHTML = '';
    
    sessions.forEach(session => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${new Date(session.date).toLocaleString('ja-JP')}</td>
            <td>${escapeHtml(session.project)}</td>
            <td>${escapeHtml(session.chapter)}</td>
            <td>${formatNumber(session.words)}</td>
            <td>${formatTime(session.duration)}</td>
            <td>${session.productivity.toFixed(0)} 文字/時</td>
        `;
    });
}

// Update goals
function updateGoals(goals) {
    // This would update the goal cards with actual data
    // For now, the HTML has static examples
}

// Handle period change
function handlePeriodChange(event) {
    currentPeriod = event.target.value;
    loadAnalyticsData();
}

// Handle project change
function handleProjectChange(event) {
    currentProject = event.target.value;
    loadAnalyticsData();
}

// Handle chart tab change
function handleChartTabChange(event) {
    const tab = event.currentTarget;
    const chartType = tab.dataset.chart;
    
    // Update active tab
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update chart data based on type
    updateTrendChart(chartType);
}

// Update trend chart
function updateTrendChart(type) {
    const datasets = {
        words: {
            label: '文字数',
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)'
        },
        time: {
            label: '時間（分）',
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)'
        },
        sessions: {
            label: 'セッション数',
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)'
        }
    };
    
    charts.trend.data.datasets[0] = {
        ...charts.trend.data.datasets[0],
        ...datasets[type]
    };
    
    // Update with appropriate data
    // This would fetch different data based on type
    charts.trend.update();
}

// Export data
window.exportData = async function() {
    try {
        const result = await window.api.invoke('analytics:export', {
            period: currentPeriod,
            projectId: currentProject === 'all' ? null : currentProject
        });
        
        if (result.success) {
            window.api.showMessage('データをエクスポートしました', 'success');
        }
    } catch (error) {
        console.error('Failed to export data:', error);
        window.api.showMessage('エクスポートに失敗しました', 'error');
    }
};

// Goal modal functions
window.showGoalModal = function() {
    document.getElementById('goal-modal').style.display = 'flex';
};

window.closeGoalModal = function() {
    document.getElementById('goal-modal').style.display = 'none';
};

window.saveGoal = async function() {
    const goalData = {
        type: document.getElementById('goal-type').value,
        metric: document.getElementById('goal-metric').value,
        target: parseInt(document.getElementById('goal-target').value),
        projectId: document.getElementById('goal-project').value || null
    };
    
    if (!goalData.target || goalData.target <= 0) {
        window.api.showMessage('目標値を入力してください', 'warning');
        return;
    }
    
    try {
        const result = await window.api.invoke('analytics:createGoal', goalData);
        if (result.success) {
            window.api.showMessage('目標を設定しました', 'success');
            closeGoalModal();
            loadAnalyticsData();
        }
    } catch (error) {
        console.error('Failed to save goal:', error);
        window.api.showMessage('目標の保存に失敗しました', 'error');
    }
};

// Load mock data for display
function loadMockData() {
    // Summary cards
    updateSummaryCards({
        totalWords: 125430,
        writingDays: 42,
        totalTime: 3600, // minutes
        dailyAverage: 2985
    });
    
    // Charts
    updateCharts({
        trend: {
            labels: ['月', '火', '水', '木', '金', '土', '日'],
            values: [2100, 1850, 2300, 2500, 1900, 3200, 2800]
        },
        projects: [
            { name: '時の輪', words: 45000 },
            { name: '記憶の図書館', words: 38000 },
            { name: '夢見る都市', words: 42430 }
        ]
    });
    
    // Heatmap
    const heatmapData = {};
    for (let i = 0; i < 365; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        heatmapData[dateStr] = {
            level: Math.floor(Math.random() * 5),
            words: Math.floor(Math.random() * 3000)
        };
    }
    updateHeatmap(heatmapData);
    
    // AI stats
    updateAIStats({
        agentMeetings: 75,
        writingAssist: 60,
        serendipitySearch: 45,
        ideaGacha: 30
    });
    
    // Session history
    updateSessionHistory([
        {
            date: new Date().toISOString(),
            project: '時の輪',
            chapter: '第5章',
            words: 2534,
            duration: 120,
            productivity: 1267
        },
        {
            date: new Date(Date.now() - 86400000).toISOString(),
            project: '記憶の図書館',
            chapter: '第3章',
            words: 1890,
            duration: 90,
            productivity: 1260
        }
    ]);
}

// Utility functions
function formatNumber(num) {
    return num.toLocaleString('ja-JP');
}

function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}