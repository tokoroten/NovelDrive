const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');

const logger = getLogger('plot-handlers');

/**
 * Setup plot-related IPC handlers
 */
function setupPlotHandlers(db) {
    const PlotRepository = require('../repositories/plot-repository');
    const plotRepo = new PlotRepository(db);

    // List plots by project
    ipcMain.handle('plot:list', async (event, { projectId }) => {
        try {
            const plots = await plotRepo.getByProject(projectId);
            return plots;
        } catch (error) {
            logger.error('Error listing plots:', error);
            throw error;
        }
    });

    // Get single plot
    ipcMain.handle('plot:get', async (event, { id }) => {
        try {
            const plot = await plotRepo.get(id);
            return plot;
        } catch (error) {
            logger.error('Error getting plot:', error);
            throw error;
        }
    });

    // Create new plot
    ipcMain.handle('plot:create', async (event, plotData) => {
        try {
            const plot = await plotRepo.create(plotData);
            logger.info(`Created new plot: ${plot.title}`);
            return plot;
        } catch (error) {
            logger.error('Error creating plot:', error);
            throw error;
        }
    });

    // Update plot
    ipcMain.handle('plot:update', async (event, { id, data }) => {
        try {
            const updatedPlot = await plotRepo.update(id, data);
            return updatedPlot;
        } catch (error) {
            logger.error('Error updating plot:', error);
            throw error;
        }
    });

    // Save plot version
    ipcMain.handle('plot:saveVersion', async (event, { id, versionData }) => {
        try {
            const updatedPlot = await plotRepo.addVersion(id, versionData);
            logger.info(`Saved version ${updatedPlot.version} for plot ${id}`);
            return updatedPlot;
        } catch (error) {
            logger.error('Error saving plot version:', error);
            throw error;
        }
    });

    // Update plot structure
    ipcMain.handle('plot:updateStructure', async (event, { id, structure }) => {
        try {
            const updatedPlot = await plotRepo.updateStructure(id, structure);
            return updatedPlot;
        } catch (error) {
            logger.error('Error updating plot structure:', error);
            throw error;
        }
    });

    // Add chapter
    ipcMain.handle('plot:addChapter', async (event, { plotId, data }) => {
        try {
            const updatedPlot = await plotRepo.addChapter(plotId, data);
            logger.info(`Added chapter to plot ${plotId}`);
            return updatedPlot;
        } catch (error) {
            logger.error('Error adding chapter:', error);
            throw error;
        }
    });

    // Update chapter
    ipcMain.handle('plot:updateChapter', async (event, { plotId, chapterId, data }) => {
        try {
            const updatedPlot = await plotRepo.updateChapter(plotId, chapterId, data);
            return updatedPlot;
        } catch (error) {
            logger.error('Error updating chapter:', error);
            throw error;
        }
    });

    // Reorder chapters
    ipcMain.handle('plot:reorderChapters', async (event, { plotId, chapterOrder }) => {
        try {
            const updatedPlot = await plotRepo.reorderChapters(plotId, chapterOrder);
            logger.info(`Reordered chapters for plot ${plotId}`);
            return updatedPlot;
        } catch (error) {
            logger.error('Error reordering chapters:', error);
            throw error;
        }
    });

    // Update character arc
    ipcMain.handle('plot:updateCharacterArc', async (event, { plotId, characterName, arcData }) => {
        try {
            const updatedPlot = await plotRepo.updateCharacterArc(plotId, characterName, arcData);
            return updatedPlot;
        } catch (error) {
            logger.error('Error updating character arc:', error);
            throw error;
        }
    });

    // Add timeline event
    ipcMain.handle('plot:addTimelineEvent', async (event, { plotId, event: timelineEvent }) => {
        try {
            const updatedPlot = await plotRepo.addTimelineEvent(plotId, timelineEvent);
            return updatedPlot;
        } catch (error) {
            logger.error('Error adding timeline event:', error);
            throw error;
        }
    });

    // Update themes
    ipcMain.handle('plot:updateThemes', async (event, { plotId, themes }) => {
        try {
            const updatedPlot = await plotRepo.updateThemes(plotId, themes);
            return updatedPlot;
        } catch (error) {
            logger.error('Error updating themes:', error);
            throw error;
        }
    });

    // Add conflict
    ipcMain.handle('plot:addConflict', async (event, { plotId, conflict }) => {
        try {
            const updatedPlot = await plotRepo.addConflict(plotId, conflict);
            return updatedPlot;
        } catch (error) {
            logger.error('Error adding conflict:', error);
            throw error;
        }
    });

    // Resolve conflict
    ipcMain.handle('plot:resolveConflict', async (event, { plotId, conflictId, resolution }) => {
        try {
            const updatedPlot = await plotRepo.resolveConflict(plotId, conflictId, resolution);
            return updatedPlot;
        } catch (error) {
            logger.error('Error resolving conflict:', error);
            throw error;
        }
    });

    // Analyze plot
    ipcMain.handle('plot:analyze', async (event, { id }) => {
        try {
            const analysis = await plotRepo.getAnalysis(id);
            return analysis;
        } catch (error) {
            logger.error('Error analyzing plot:', error);
            throw error;
        }
    });

    // Delete plot
    ipcMain.handle('plot:delete', async (event, { id }) => {
        try {
            await plotRepo.delete(id);
            logger.info(`Deleted plot ${id}`);
            return { success: true };
        } catch (error) {
            logger.error('Error deleting plot:', error);
            throw error;
        }
    });

    logger.info('Plot handlers initialized');
}

module.exports = setupPlotHandlers;