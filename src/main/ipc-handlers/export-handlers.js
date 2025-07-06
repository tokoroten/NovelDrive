const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');
const exportService = require('../services/export-service');
const { getProjectRepository, getPlotRepository, getChapterRepository } = require('../repositories');

const logger = getLogger('export-handlers');

/**
 * Register export-related IPC handlers
 */
function registerExportHandlers() {
    // Export chapter
    ipcMain.handle('export:chapter', async (event, data) => {
        try {
            const { chapterId, plotId, format, options } = data;
            
            // Get chapter content
            const chapterRepo = getChapterRepository();
            const content = await chapterRepo.getContent(plotId, chapterId);
            
            // Get chapter metadata
            const plotRepo = getPlotRepository();
            const plot = await plotRepo.findById(plotId);
            const chapter = plot.chapters.find(ch => ch.id === chapterId);
            
            if (!chapter) {
                throw new Error('Chapter not found');
            }
            
            // Export
            const filePath = await exportService.export({
                content: content || '',
                format: format || 'txt',
                title: `${chapter.title}_第${chapter.number}章`,
                metadata: {
                    chapterNumber: chapter.number,
                    chapterTitle: chapter.title,
                    plotTitle: plot.title,
                    wordCount: chapter.wordCount || 0
                },
                ...options
            });
            
            logger.info(`Exported chapter ${chapterId} to ${filePath}`);
            return { success: true, filePath };
            
        } catch (error) {
            logger.error('Failed to export chapter:', error);
            throw error;
        }
    });
    
    // Export plot
    ipcMain.handle('export:plot', async (event, data) => {
        try {
            const { plotId, format, options } = data;
            
            // Get plot with all chapters
            const plotRepo = getPlotRepository();
            const plot = await plotRepo.findById(plotId);
            
            if (!plot) {
                throw new Error('Plot not found');
            }
            
            // Compile all chapters
            let content = `${plot.title}\n${'='.repeat(plot.title.length)}\n\n`;
            
            if (plot.description) {
                content += `${plot.description}\n\n`;
            }
            
            // Add chapters
            const chapterRepo = getChapterRepository();
            for (const chapter of plot.chapters || []) {
                content += `\n第${chapter.number}章: ${chapter.title}\n${'-'.repeat(20)}\n\n`;
                
                const chapterContent = await chapterRepo.getContent(plotId, chapter.id);
                if (chapterContent) {
                    content += chapterContent + '\n\n';
                }
            }
            
            // Export
            const filePath = await exportService.export({
                content,
                format: format || 'txt',
                title: plot.title,
                metadata: {
                    plotTitle: plot.title,
                    totalChapters: plot.chapters?.length || 0,
                    totalWords: plot.chapters?.reduce((sum, ch) => sum + (ch.wordCount || 0), 0) || 0
                },
                ...options
            });
            
            logger.info(`Exported plot ${plotId} to ${filePath}`);
            return { success: true, filePath };
            
        } catch (error) {
            logger.error('Failed to export plot:', error);
            throw error;
        }
    });
    
    // Export project
    ipcMain.handle('export:project', async (event, data) => {
        try {
            const { projectId, format, options } = data;
            
            // Get project with all related data
            const projectRepo = getProjectRepository();
            const project = await projectRepo.findById(projectId);
            
            if (!project) {
                throw new Error('Project not found');
            }
            
            // Get all plots
            const plotRepo = getPlotRepository();
            const plots = await plotRepo.findBy('project_id', projectId);
            
            // Prepare project data
            const projectData = {
                ...project,
                plots: []
            };
            
            // Get chapter content for each plot
            const chapterRepo = getChapterRepository();
            for (const plot of plots) {
                const plotData = {
                    ...plot,
                    chapters: []
                };
                
                for (const chapter of plot.chapters || []) {
                    const content = await chapterRepo.getContent(plot.id, chapter.id);
                    plotData.chapters.push({
                        ...chapter,
                        content
                    });
                }
                
                projectData.plots.push(plotData);
            }
            
            // Export
            const filePath = await exportService.exportProject(projectData, {
                format: format || 'txt',
                ...options
            });
            
            logger.info(`Exported project ${projectId} to ${filePath}`);
            return { success: true, filePath };
            
        } catch (error) {
            logger.error('Failed to export project:', error);
            throw error;
        }
    });
    
    // Export selection
    ipcMain.handle('export:selection', async (event, data) => {
        try {
            const { content, title, format, options } = data;
            
            if (!content) {
                throw new Error('No content to export');
            }
            
            // Export
            const filePath = await exportService.export({
                content,
                format: format || 'txt',
                title: title || 'Selection',
                ...options
            });
            
            logger.info(`Exported selection to ${filePath}`);
            return { success: true, filePath };
            
        } catch (error) {
            logger.error('Failed to export selection:', error);
            throw error;
        }
    });
    
    // Get export formats
    ipcMain.handle('export:getFormats', async () => {
        return {
            formats: [
                { value: 'txt', label: 'プレーンテキスト (.txt)', available: true },
                { value: 'md', label: 'Markdown (.md)', available: true },
                { value: 'docx', label: 'Microsoft Word (.docx)', available: true },
                { value: 'pdf', label: 'PDF', available: false }
            ]
        };
    });
    
    logger.info('Export handlers registered');
}

module.exports = {
    registerExportHandlers
};