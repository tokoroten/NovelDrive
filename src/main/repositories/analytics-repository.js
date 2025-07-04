const BaseRepository = require('./base-repository');
const { getLogger } = require('../utils/logger');

/**
 * Repository for managing analytics data
 */
class AnalyticsRepository extends BaseRepository {
    constructor(db) {
        super(db, 'analytics');
        this.logger = getLogger('analytics-repository');
    }

    /**
     * Record a writing session
     * @param {Object} session
     * @returns {Promise<Object>}
     */
    async recordSession(session) {
        const now = new Date();
        const record = {
            ...session,
            date: now.toISOString(),
            createdAt: now.toISOString()
        };
        
        return super.create(record);
    }

    /**
     * Get sessions by date range
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {number} projectId
     * @returns {Promise<Array>}
     */
    async getSessionsByDateRange(startDate, endDate, projectId = null) {
        try {
            let query = { 
                date: { 
                    $gte: startDate.toISOString(), 
                    $lte: endDate.toISOString() 
                } 
            };
            
            if (projectId) {
                query.projectId = projectId;
            }
            
            const sessions = await this.list(query);
            return sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            this.logger.error('Failed to get sessions by date range:', error);
            throw error;
        }
    }

    /**
     * Get statistics for a period
     * @param {string} period - 'week', 'month', 'year', 'all'
     * @param {number} projectId
     * @returns {Promise<Object>}
     */
    async getStatistics(period = 'month', projectId = null) {
        try {
            const { startDate, endDate } = this.getPeriodDates(period);
            const sessions = await this.getSessionsByDateRange(startDate, endDate, projectId);
            
            // Calculate summary statistics
            const summary = {
                totalWords: 0,
                totalTime: 0,
                writingDays: new Set(),
                dailyAverage: 0
            };
            
            sessions.forEach(session => {
                summary.totalWords += session.wordCount || 0;
                summary.totalTime += session.duration || 0;
                summary.writingDays.add(session.date.split('T')[0]);
            });
            
            summary.writingDays = summary.writingDays.size;
            summary.dailyAverage = summary.writingDays > 0 
                ? Math.round(summary.totalWords / summary.writingDays) 
                : 0;
            
            // Get trend data
            const trend = this.getTrendData(sessions, period);
            
            // Get project stats
            const projects = await this.getProjectStats(sessions);
            
            // Get heatmap data
            const heatmap = this.getHeatmapData(sessions);
            
            // Get AI usage stats
            const aiStats = await this.getAIStats(startDate, endDate, projectId);
            
            return {
                summary,
                trend,
                projects,
                heatmap,
                aiStats,
                sessions: sessions.slice(0, 10) // Recent 10 sessions
            };
        } catch (error) {
            this.logger.error('Failed to get statistics:', error);
            throw error;
        }
    }

    /**
     * Get period dates
     * @param {string} period
     * @returns {Object}
     */
    getPeriodDates(period) {
        const endDate = new Date();
        const startDate = new Date();
        
        switch (period) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case 'all':
                startDate.setFullYear(2000); // Far past date
                break;
        }
        
        return { startDate, endDate };
    }

    /**
     * Get trend data
     * @param {Array} sessions
     * @param {string} period
     * @returns {Object}
     */
    getTrendData(sessions, period) {
        const data = {};
        
        sessions.forEach(session => {
            const date = new Date(session.date);
            let key;
            
            if (period === 'week') {
                key = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            } else if (period === 'month') {
                key = date.getDate();
            } else {
                key = `${date.getMonth() + 1}月`;
            }
            
            if (!data[key]) {
                data[key] = 0;
            }
            data[key] += session.wordCount || 0;
        });
        
        return {
            labels: Object.keys(data),
            values: Object.values(data)
        };
    }

    /**
     * Get project statistics
     * @param {Array} sessions
     * @returns {Promise<Array>}
     */
    async getProjectStats(sessions) {
        const projectData = {};
        
        for (const session of sessions) {
            if (!session.projectId) continue;
            
            if (!projectData[session.projectId]) {
                projectData[session.projectId] = {
                    id: session.projectId,
                    name: session.projectName || 'Unknown',
                    words: 0,
                    sessions: 0,
                    time: 0
                };
            }
            
            projectData[session.projectId].words += session.wordCount || 0;
            projectData[session.projectId].sessions += 1;
            projectData[session.projectId].time += session.duration || 0;
        }
        
        return Object.values(projectData);
    }

    /**
     * Get heatmap data
     * @param {Array} sessions
     * @returns {Object}
     */
    getHeatmapData(sessions) {
        const heatmap = {};
        
        sessions.forEach(session => {
            const date = session.date.split('T')[0];
            const words = session.wordCount || 0;
            
            if (!heatmap[date]) {
                heatmap[date] = { words: 0, level: 0 };
            }
            
            heatmap[date].words += words;
        });
        
        // Calculate levels (0-4)
        const values = Object.values(heatmap).map(d => d.words);
        const max = Math.max(...values);
        
        Object.keys(heatmap).forEach(date => {
            const percentage = heatmap[date].words / max;
            if (percentage === 0) heatmap[date].level = 0;
            else if (percentage < 0.25) heatmap[date].level = 1;
            else if (percentage < 0.5) heatmap[date].level = 2;
            else if (percentage < 0.75) heatmap[date].level = 3;
            else heatmap[date].level = 4;
        });
        
        return heatmap;
    }

    /**
     * Get AI usage statistics
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {number} projectId
     * @returns {Promise<Object>}
     */
    async getAIStats(startDate, endDate, projectId) {
        // This would query actual AI usage logs
        // For now, return mock data
        return {
            agentMeetings: Math.floor(Math.random() * 100),
            writingAssist: Math.floor(Math.random() * 80),
            serendipitySearch: Math.floor(Math.random() * 60),
            ideaGacha: Math.floor(Math.random() * 40)
        };
    }

    /**
     * Create writing goal
     * @param {Object} goalData
     * @returns {Promise<Object>}
     */
    async createGoal(goalData) {
        const goal = {
            ...goalData,
            progress: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Store in a separate goals collection/table
        // For now, store in analytics with type='goal'
        return super.create({ ...goal, type: 'goal' });
    }

    /**
     * Update goal progress
     * @param {number} goalId
     * @param {number} progress
     * @returns {Promise<Object>}
     */
    async updateGoalProgress(goalId, progress) {
        const goal = await this.get(goalId);
        if (!goal) throw new Error('Goal not found');
        
        goal.progress = progress;
        goal.updatedAt = new Date().toISOString();
        
        // Update status based on progress
        if (progress >= goal.target) {
            goal.status = 'completed';
        } else if (progress < goal.target * 0.5 && this.isGoalExpiring(goal)) {
            goal.status = 'warning';
        }
        
        return this.update(goalId, goal);
    }

    /**
     * Check if goal is expiring soon
     * @param {Object} goal
     * @returns {boolean}
     */
    isGoalExpiring(goal) {
        const now = new Date();
        const created = new Date(goal.createdAt);
        
        switch (goal.type) {
            case 'daily':
                return now.getDate() !== created.getDate();
            case 'weekly':
                const weekDiff = Math.floor((now - created) / (7 * 24 * 60 * 60 * 1000));
                return weekDiff > 0;
            case 'monthly':
                return now.getMonth() !== created.getMonth();
            default:
                return false;
        }
    }

    /**
     * Export analytics data
     * @param {string} period
     * @param {number} projectId
     * @returns {Promise<Object>}
     */
    async exportData(period, projectId) {
        const stats = await this.getStatistics(period, projectId);
        
        // Format for export (CSV, JSON, etc.)
        const exportData = {
            summary: stats.summary,
            sessions: stats.sessions.map(s => ({
                date: s.date,
                project: s.projectName,
                chapter: s.chapterTitle,
                words: s.wordCount,
                duration: s.duration,
                productivity: s.wordCount / (s.duration / 60)
            }))
        };
        
        return exportData;
    }
}

module.exports = AnalyticsRepository;