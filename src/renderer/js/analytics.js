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
        // Use Mock API if available
        const response = window.api ? 
            await window.api.invoke('project:getAll') :
            await window.mockAPI.invoke('project:getAll');
            
        const projects = response.success ? response.data : response;
        const selector = document.getElementById('project-filter');
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name || project.title;
            selector.appendChild(option);
        });
        
        // Also populate goal project selector
        const goalSelector = document.getElementById('goal-project');
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name || project.title;
            goalSelector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load projects:', error);
        // Load mock data on error
        loadMockData();
    }
}

// Load analytics data
async function loadAnalyticsData() {
    try {
        // Use Mock API if available
        const result = window.api ? 
            await window.api.invoke('analytics:getData', {
                period: currentPeriod,
                projectId: currentProject === 'all' ? null : currentProject
            }) :
            await window.mockAPI.invoke('analytics:getData', {
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
    // Initialize empty chart containers
    charts.trend = {
        data: { labels: [], values: [] },
        container: document.getElementById('writing-trend-chart')
    };
    
    charts.project = {
        data: { labels: [], values: [] },
        container: document.getElementById('project-stats-chart')
    };
    
    // Create initial empty charts
    createBarChart(charts.trend.container, [], []);
    createDonutChart(charts.project.container, [], []);
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
    charts.trend.data.values = data.trend.values;
    createBarChart(charts.trend.container, data.trend.labels, data.trend.values);
    
    // Update project chart
    const projectLabels = data.projects.map(p => p.name);
    const projectValues = data.projects.map(p => p.words);
    charts.project.data.labels = projectLabels;
    charts.project.data.values = projectValues;
    createDonutChart(charts.project.container, projectLabels, projectValues);
}

// Update heatmap with animations
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
            cell.style.opacity = '0';
            cell.style.transform = 'scale(0.8)';
            
            const date = new Date();
            date.setDate(date.getDate() - ((weeks - week - 1) * 7 + (6 - day)));
            const dateStr = date.toISOString().split('T')[0];
            
            const data = heatmapData[dateStr] || { level: 0, words: 0 };
            cell.dataset.level = data.level;
            
            // Enhanced tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'heatmap-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-date">${formatDate(date)}</div>
                <div class="tooltip-words">${formatNumber(data.words)} 文字</div>
                <div class="tooltip-level">レベル ${data.level}/4</div>
            `;
            cell.appendChild(tooltip);
            
            // Add interactive events
            cell.addEventListener('mouseenter', showHeatmapTooltip);
            cell.addEventListener('mouseleave', hideHeatmapTooltip);
            cell.addEventListener('click', () => {
                showDateDetails(dateStr, data);
            });
            
            container.appendChild(cell);
            
            // Animate cell appearance
            const delay = (week * days + day) * 5; // Stagger animation
            setTimeout(() => {
                cell.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                cell.style.opacity = '1';
                cell.style.transform = 'scale(1)';
            }, delay);
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
    // For now, use the same data but would normally fetch different data based on type
    const labels = charts.trend.data.labels;
    const values = charts.trend.data.values;
    
    // Update chart with current data
    createBarChart(charts.trend.container, labels, values);
}

// Create CSS-based bar chart with animations
function createBarChart(container, labels, values) {
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'css-chart';
    
    if (!labels.length || !values.length) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">データがありません</div>';
        return;
    }
    
    const maxValue = Math.max(...values);
    
    labels.forEach((label, index) => {
        const value = values[index];
        const height = maxValue > 0 ? (value / maxValue) * 80 : 0; // 80% max height
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = '0%';
        bar.style.opacity = '0';
        bar.innerHTML = `
            <div class="chart-bar-value">${formatNumber(value)}</div>
            <div class="chart-bar-label">${label}</div>
            <div class="chart-tooltip">
                <div class="tooltip-content">
                    <strong>${label}</strong><br>
                    ${formatNumber(value)} 文字
                </div>
            </div>
        `;
        
        // Add hover events for tooltip
        bar.addEventListener('mouseenter', showChartTooltip);
        bar.addEventListener('mouseleave', hideChartTooltip);
        
        container.appendChild(bar);
        
        // Animate bar with delay
        setTimeout(() => {
            bar.style.transition = 'height 0.8s ease, opacity 0.8s ease';
            bar.style.height = `${height}%`;
            bar.style.opacity = '1';
        }, index * 100);
    });
}

// Create CSS-based donut chart with animations
function createDonutChart(container, labels, values) {
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'css-chart css-donut-chart';
    
    if (!labels.length || !values.length) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">データがありません</div>';
        return;
    }
    
    const total = values.reduce((sum, value) => sum + value, 0);
    
    // Generate colors
    const colors = [
        'var(--primary-color)',
        'var(--secondary-color)', 
        'var(--accent-color)',
        'var(--warning-color)',
        'var(--success-color)'
    ];
    
    // Create donut chart
    let cumulativeAngle = 0;
    const gradientParts = [];
    const segments = [];
    
    values.forEach((value, index) => {
        const percentage = (value / total) * 100;
        const angle = (value / total) * 360;
        const color = colors[index % colors.length];
        
        gradientParts.push(`${color} ${cumulativeAngle}deg ${cumulativeAngle + angle}deg`);
        segments.push({
            label: labels[index],
            value: value,
            percentage: percentage,
            color: color,
            startAngle: cumulativeAngle,
            endAngle: cumulativeAngle + angle
        });
        cumulativeAngle += angle;
    });
    
    const donutContainer = document.createElement('div');
    donutContainer.className = 'donut-container';
    
    const donutChart = document.createElement('div');
    donutChart.className = 'donut-chart animated-donut';
    donutChart.style.background = `conic-gradient(var(--bg-secondary) 0deg 360deg)`;
    
    // Add interactive tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'donut-tooltip';
    tooltip.style.display = 'none';
    donutContainer.appendChild(tooltip);
    
    // Add hover functionality
    donutChart.addEventListener('mousemove', (e) => {
        const rect = donutChart.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const x = e.clientX - rect.left - centerX;
        const y = e.clientY - rect.top - centerY;
        
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
        
        const segment = segments.find(s => angle >= s.startAngle && angle < s.endAngle);
        if (segment) {
            tooltip.innerHTML = `
                <div class="tooltip-title">${segment.label}</div>
                <div class="tooltip-value">${formatNumber(segment.value)} 文字</div>
                <div class="tooltip-percentage">${segment.percentage.toFixed(1)}%</div>
            `;
            tooltip.style.display = 'block';
            tooltip.style.left = e.clientX - rect.left + 'px';
            tooltip.style.top = e.clientY - rect.top + 'px';
        } else {
            tooltip.style.display = 'none';
        }
    });
    
    donutChart.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
    
    const donutCenter = document.createElement('div');
    donutCenter.className = 'donut-center';
    donutCenter.innerHTML = `
        <div class="donut-center-value">0</div>
        <div class="donut-center-label">総文字数</div>
    `;
    
    donutContainer.appendChild(donutChart);
    donutContainer.appendChild(donutCenter);
    
    // Create legend with animations
    const legend = document.createElement('div');
    legend.className = 'donut-legend';
    
    labels.forEach((label, index) => {
        const value = values[index];
        const color = colors[index % colors.length];
        
        const legendItem = document.createElement('div');
        legendItem.className = 'donut-legend-item';
        legendItem.style.opacity = '0';
        legendItem.style.transform = 'translateY(10px)';
        legendItem.innerHTML = `
            <div class="donut-legend-color" style="background-color: ${color}"></div>
            <span>${label}: ${formatNumber(value)}</span>
        `;
        
        legend.appendChild(legendItem);
        
        // Animate legend items
        setTimeout(() => {
            legendItem.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            legendItem.style.opacity = '1';
            legendItem.style.transform = 'translateY(0)';
        }, index * 150);
    });
    
    container.appendChild(donutContainer);
    container.appendChild(legend);
    
    // Animate donut chart
    setTimeout(() => {
        donutChart.style.transition = 'background 1s ease';
        donutChart.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        // Animate center value
        animateNumber(donutCenter.querySelector('.donut-center-value'), 0, total, 1000);
    }, 300);
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

// Utility functions for animations and interactions
function showChartTooltip(event) {
    const tooltip = event.currentTarget.querySelector('.chart-tooltip');
    if (tooltip) {
        tooltip.style.display = 'block';
    }
}

function hideChartTooltip(event) {
    const tooltip = event.currentTarget.querySelector('.chart-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function showHeatmapTooltip(event) {
    const tooltip = event.currentTarget.querySelector('.heatmap-tooltip');
    if (tooltip) {
        tooltip.style.display = 'block';
    }
}

function hideHeatmapTooltip(event) {
    const tooltip = event.currentTarget.querySelector('.heatmap-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function showDateDetails(dateStr, data) {
    alert(`${dateStr}\n文字数: ${formatNumber(data.words)}\nレベル: ${data.level}/4`);
}

function formatDate(date) {
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.floor(start + (end - start) * progress);
        element.textContent = formatNumber(current);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}