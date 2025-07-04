const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');

const logger = getLogger('analytics-handlers');

function registerAnalyticsHandlers(db) {
    const AnalyticsRepository = require('../repositories/analytics-repository');
    const analyticsRepo = new AnalyticsRepository(db);

    // Get analytics data
    ipcMain.handle('analytics:getData', async (event, { period, projectId }) => {
        try {
            const data = await analyticsRepo.getStatistics(period, projectId);
            return { success: true, data };
        } catch (error) {
            logger.error('Failed to get analytics data:', error);
            return { success: false, error: error.message };
        }
    });

    // Record writing session
    ipcMain.handle('analytics:recordSession', async (event, sessionData) => {
        try {
            const session = await analyticsRepo.recordSession(sessionData);
            return { success: true, data: session };
        } catch (error) {
            logger.error('Failed to record session:', error);
            return { success: false, error: error.message };
        }
    });

    // Create goal
    ipcMain.handle('analytics:createGoal', async (event, goalData) => {
        try {
            const goal = await analyticsRepo.createGoal(goalData);
            return { success: true, data: goal };
        } catch (error) {
            logger.error('Failed to create goal:', error);
            return { success: false, error: error.message };
        }
    });

    // Update goal progress
    ipcMain.handle('analytics:updateGoalProgress', async (event, { goalId, progress }) => {
        try {
            const updated = await analyticsRepo.updateGoalProgress(goalId, progress);
            return { success: true, data: updated };
        } catch (error) {
            logger.error('Failed to update goal progress:', error);
            return { success: false, error: error.message };
        }
    });

    // Export analytics data
    ipcMain.handle('analytics:export', async (event, { period, projectId }) => {
        try {
            const data = await analyticsRepo.exportData(period, projectId);
            
            // Here you would typically save to file or return formatted data
            // For now, we'll just return the data
            return { success: true, data };
        } catch (error) {
            logger.error('Failed to export analytics:', error);
            return { success: false, error: error.message };
        }
    });

    // Get AI usage stats
    ipcMain.handle('analytics:getAIStats', async (event, { startDate, endDate, projectId }) => {
        try {
            const stats = await analyticsRepo.getAIStats(
                new Date(startDate),
                new Date(endDate),
                projectId
            );
            return { success: true, data: stats };
        } catch (error) {
            logger.error('Failed to get AI stats:', error);
            return { success: false, error: error.message };
        }
    });

    logger.info('Analytics handlers registered');
}

module.exports = { registerAnalyticsHandlers };