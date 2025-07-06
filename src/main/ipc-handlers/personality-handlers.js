const { ipcMain } = require('electron');
const personalityService = require('../services/personality-service');
const { getLogger } = require('../utils/logger');

const logger = getLogger('personality-handlers');

/**
 * Initialize personality IPC handlers
 */
function initializePersonalityHandlers() {
    // Get all personalities
    ipcMain.handle('personality:get-all', async () => {
        try {
            const personalities = personalityService.getAllPersonalities();
            return {
                success: true,
                data: personalities
            };
        } catch (error) {
            logger.error('Failed to get personalities:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get personalities by role
    ipcMain.handle('personality:get-by-role', async (event, role) => {
        try {
            const personalities = personalityService.getPersonalitiesByRole(role);
            return {
                success: true,
                data: personalities
            };
        } catch (error) {
            logger.error('Failed to get personalities by role:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get current assignments
    ipcMain.handle('personality:get-assignments', async () => {
        try {
            const assignments = personalityService.getCurrentAssignments();
            return {
                success: true,
                data: assignments
            };
        } catch (error) {
            logger.error('Failed to get personality assignments:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Switch personality
    ipcMain.handle('personality:switch', async (event, { role, personalityId }) => {
        try {
            await personalityService.switchPersonality(role, personalityId);
            
            // Get the updated personality
            const personality = personalityService.getPersonality(personalityId);
            
            return {
                success: true,
                data: {
                    role,
                    personality
                }
            };
        } catch (error) {
            logger.error('Failed to switch personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get all presets
    ipcMain.handle('personality:get-presets', async () => {
        try {
            const presets = personalityService.getAllPresets();
            return {
                success: true,
                data: presets
            };
        } catch (error) {
            logger.error('Failed to get presets:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Apply preset
    ipcMain.handle('personality:apply-preset', async (event, presetId) => {
        try {
            const results = await personalityService.applyPreset(presetId);
            return {
                success: true,
                data: results
            };
        } catch (error) {
            logger.error('Failed to apply preset:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Create custom personality
    ipcMain.handle('personality:create', async (event, personalityData) => {
        try {
            const personality = await personalityService.createCustomPersonality(personalityData);
            return {
                success: true,
                data: personality
            };
        } catch (error) {
            logger.error('Failed to create personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Generate personality with AI
    ipcMain.handle('personality:generate', async (event, params) => {
        try {
            const personality = await personalityService.generatePersonality(params);
            return {
                success: true,
                data: personality
            };
        } catch (error) {
            logger.error('Failed to generate personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Update personality
    ipcMain.handle('personality:update', async (event, { personalityId, updates }) => {
        try {
            const personality = await personalityService.updatePersonality(personalityId, updates);
            return {
                success: true,
                data: personality
            };
        } catch (error) {
            logger.error('Failed to update personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Delete personality
    ipcMain.handle('personality:delete', async (event, personalityId) => {
        try {
            await personalityService.deletePersonality(personalityId);
            return {
                success: true
            };
        } catch (error) {
            logger.error('Failed to delete personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Create preset
    ipcMain.handle('personality:create-preset', async (event, presetData) => {
        try {
            const preset = personalityService.createPreset(presetData);
            return {
                success: true,
                data: preset
            };
        } catch (error) {
            logger.error('Failed to create preset:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Delete preset
    ipcMain.handle('personality:delete-preset', async (event, presetId) => {
        try {
            await personalityService.deletePreset(presetId);
            return {
                success: true
            };
        } catch (error) {
            logger.error('Failed to delete preset:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Export personality
    ipcMain.handle('personality:export', async (event, personalityId) => {
        try {
            const data = personalityService.exportPersonality(personalityId);
            return {
                success: true,
                data: data
            };
        } catch (error) {
            logger.error('Failed to export personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Import personality
    ipcMain.handle('personality:import', async (event, personalityData) => {
        try {
            const personality = await personalityService.importPersonality(personalityData);
            return {
                success: true,
                data: personality
            };
        } catch (error) {
            logger.error('Failed to import personality:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get statistics
    ipcMain.handle('personality:get-stats', async () => {
        try {
            const stats = personalityService.getStatistics();
            return {
                success: true,
                data: stats
            };
        } catch (error) {
            logger.error('Failed to get personality stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Set custom personalities path
    ipcMain.handle('personality:set-custom-path', async (event, customPath) => {
        try {
            personalityService.setCustomPersonalitiesPath(customPath);
            return {
                success: true
            };
        } catch (error) {
            logger.error('Failed to set custom personalities path:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Listen for personality service events
    personalityService.on('personality:switched', (data) => {
        // Notify all windows about personality switch
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('personality:switched', data);
        });
    });

    personalityService.on('preset:applied', (data) => {
        // Notify all windows about preset application
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('preset:applied', data);
        });
    });

    personalityService.on('personality:created', (personality) => {
        // Notify all windows about new personality
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('personality:created', personality);
        });
    });

    personalityService.on('personality:updated', (personality) => {
        // Notify all windows about personality update
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('personality:updated', personality);
        });
    });

    personalityService.on('personality:deleted', (personality) => {
        // Notify all windows about personality deletion
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('personality:deleted', personality);
        });
    });

    logger.info('Personality IPC handlers initialized');
}

module.exports = {
    initializePersonalityHandlers
};