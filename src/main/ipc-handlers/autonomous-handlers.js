const { ipcMain, dialog } = require('electron');
const autonomousService = require('../services/autonomous-service');
const { getLogger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const logger = getLogger();

/**
 * Register autonomous mode IPC handlers
 */
function registerAutonomousHandlers() {
    /**
     * Start autonomous session
     */
    ipcMain.handle('autonomous:start', async (event, config) => {
        try {
            logger.info('Starting autonomous session with config:', config);
            const result = await autonomousService.startSession(config);
            return { success: true, data: result };
        } catch (error) {
            logger.error('Error starting autonomous session:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Pause autonomous session
     */
    ipcMain.handle('autonomous:pause', async () => {
        try {
            const result = await autonomousService.pauseSession();
            return { success: true, data: result };
        } catch (error) {
            logger.error('Error pausing autonomous session:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Resume autonomous session
     */
    ipcMain.handle('autonomous:resume', async () => {
        try {
            const result = await autonomousService.resumeSession();
            return { success: true, data: result };
        } catch (error) {
            logger.error('Error resuming autonomous session:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Stop autonomous session
     */
    ipcMain.handle('autonomous:stop', async () => {
        try {
            const result = await autonomousService.stopSession();
            return { success: true, data: result };
        } catch (error) {
            logger.error('Error stopping autonomous session:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Get session status
     */
    ipcMain.handle('autonomous:status', async () => {
        try {
            const status = autonomousService.getSessionStatus();
            return { success: true, data: status };
        } catch (error) {
            logger.error('Error getting session status:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Get session history
     */
    ipcMain.handle('autonomous:history', async () => {
        try {
            const history = autonomousService.getSessionHistory();
            return { success: true, data: history };
        } catch (error) {
            logger.error('Error getting session history:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Get available schedules
     */
    ipcMain.handle('autonomous:schedules', async () => {
        try {
            const schedulesDir = path.join(__dirname, '..', 'schedules');
            const files = await fs.readdir(schedulesDir);
            
            const schedules = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const data = await fs.readFile(path.join(schedulesDir, file), 'utf8');
                    const schedule = JSON.parse(data);
                    schedules.push({
                        id: path.basename(file, '.json'),
                        name: schedule.name,
                        description: schedule.description,
                        totalDuration: schedule.totalCycleDuration,
                        restPercentage: schedule.restPercentage
                    });
                }
            }
            
            return { success: true, data: schedules };
        } catch (error) {
            logger.error('Error getting schedules:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Get session outputs
     */
    ipcMain.handle('autonomous:outputs', async (event, sessionId, limit = 50) => {
        try {
            const outputPath = path.join(
                process.cwd(),
                'autonomous-outputs',
                sessionId,
                'outputs.json'
            );
            
            const data = await fs.readFile(outputPath, 'utf8');
            const outputs = JSON.parse(data);
            
            // Return limited outputs for UI performance
            const limitedOutputs = outputs.slice(-limit);
            
            return { success: true, data: limitedOutputs };
        } catch (error) {
            logger.error('Error getting outputs:', error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Export session data
     */
    ipcMain.handle('autonomous:export', async (event, sessionId, exportPath) => {
        try {
            const sessionDir = path.join(
                process.cwd(),
                'autonomous-outputs',
                sessionId
            );
            
            // Copy session data to export path
            const sessionData = await fs.readFile(
                path.join(sessionDir, 'session.json'),
                'utf8'
            );
            const outputsData = await fs.readFile(
                path.join(sessionDir, 'outputs.json'),
                'utf8'
            );
            
            // Create export directory
            await fs.mkdir(exportPath, { recursive: true });
            
            // Write files
            await fs.writeFile(
                path.join(exportPath, `session-${sessionId}.json`),
                sessionData
            );
            await fs.writeFile(
                path.join(exportPath, `outputs-${sessionId}.json`),
                outputsData
            );
            
            // Create human-readable summary
            const session = JSON.parse(sessionData);
            const outputs = JSON.parse(outputsData);
            
            let summary = `# Autonomous Session Report\n\n`;
            summary += `**Session ID:** ${session.id}\n`;
            summary += `**Start Time:** ${new Date(session.startTime).toLocaleString()}\n`;
            summary += `**End Time:** ${session.endTime ? new Date(session.endTime).toLocaleString() : 'N/A'}\n`;
            summary += `**Schedule:** ${session.schedule}\n\n`;
            
            summary += `## Metrics\n`;
            summary += `- Words Written: ${session.metrics.wordsWritten}\n`;
            summary += `- Ideas Generated: ${session.metrics.ideasGenerated}\n`;
            summary += `- Chapters Completed: ${session.metrics.chaptersCompleted}\n`;
            summary += `- Revisions Completed: ${session.metrics.revisionsCompleted}\n\n`;
            
            summary += `## Activities\n`;
            const activityCounts = {};
            session.activities.forEach(activity => {
                activityCounts[activity.type] = (activityCounts[activity.type] || 0) + 1;
            });
            Object.entries(activityCounts).forEach(([type, count]) => {
                summary += `- ${type}: ${count} sessions\n`;
            });
            
            summary += `\n## Sample Outputs\n`;
            outputs.slice(-10).forEach((output, index) => {
                summary += `\n### Output ${index + 1} (${output.type})\n`;
                summary += `**Agent:** ${output.agentId}\n`;
                summary += `**Content:** ${JSON.stringify(output.content).substring(0, 200)}...\n`;
            });
            
            await fs.writeFile(
                path.join(exportPath, `summary-${sessionId}.md`),
                summary
            );
            
            return { 
                success: true, 
                data: { 
                    exportPath,
                    files: [
                        `session-${sessionId}.json`,
                        `outputs-${sessionId}.json`,
                        `summary-${sessionId}.md`
                    ]
                }
            };
        } catch (error) {
            logger.error('Error exporting session:', error);
            return { success: false, error: error.message };
        }
    });

    // Forward events to renderer
    autonomousService.on('session:started', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'session:started',
            data
        });
    });

    autonomousService.on('session:paused', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'session:paused',
            data
        });
    });

    autonomousService.on('session:resumed', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'session:resumed',
            data
        });
    });

    autonomousService.on('session:completed', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'session:completed',
            data
        });
    });

    autonomousService.on('activity:started', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'activity:started',
            data
        });
    });

    autonomousService.on('activity:completed', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'activity:completed',
            data
        });
    });

    autonomousService.on('activity:error', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'activity:error',
            data
        });
    });

    autonomousService.on('checkpoint:saved', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'checkpoint:saved',
            data
        });
    });

    autonomousService.on('rest:started', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'rest:started',
            data
        });
    });

    autonomousService.on('rest:completed', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'rest:completed',
            data
        });
    });

    autonomousService.on('agent:message', (data) => {
        global.mainWindow?.webContents.send('autonomous:event', {
            type: 'agent:message',
            data
        });
    });

    logger.info('Autonomous handlers registered');
}

module.exports = { registerAutonomousHandlers };