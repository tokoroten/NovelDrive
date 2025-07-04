const BaseRepository = require('./base-repository');
const { getLogger } = require('../utils/logger');

/**
 * Repository for managing plots
 */
class PlotRepository extends BaseRepository {
    constructor(db) {
        super(db, 'plots');
        this.logger = getLogger('plot-repository');
    }

    /**
     * Create a new plot
     * @param {Object} plotData
     * @returns {Promise<Object>}
     */
    async create(plotData) {
        const plot = {
            ...plotData,
            version: 1,
            versions: [],
            chapters: [],
            characterArcs: {},
            themes: [],
            timeline: [],
            settings: [],
            conflicts: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return super.create(plot);
    }

    /**
     * Get plots by project
     * @param {number} projectId
     * @returns {Promise<Array>}
     */
    async getByProject(projectId) {
        try {
            const plots = await this.list({ projectId });
            return plots;
        } catch (error) {
            this.logger.error('Error getting plots by project:', error);
            throw error;
        }
    }

    /**
     * Add a new plot version
     * @param {number} plotId
     * @param {Object} versionData
     * @returns {Promise<Object>}
     */
    async addVersion(plotId, versionData) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const newVersion = {
            version: plot.version + 1,
            data: versionData,
            changes: versionData.changes || [],
            createdAt: new Date().toISOString(),
            createdBy: versionData.createdBy || 'user'
        };

        // Archive current version
        plot.versions.push({
            version: plot.version,
            data: {
                title: plot.title,
                premise: plot.premise,
                structure: plot.structure,
                chapters: plot.chapters,
                themes: plot.themes,
                timeline: plot.timeline
            },
            archivedAt: new Date().toISOString()
        });

        // Update plot with new version
        const updatedPlot = {
            ...plot,
            ...versionData,
            version: newVersion.version,
            versions: plot.versions,
            updatedAt: new Date().toISOString()
        };

        return this.update(plotId, updatedPlot);
    }

    /**
     * Update plot structure
     * @param {number} plotId
     * @param {Object} structure
     * @returns {Promise<Object>}
     */
    async updateStructure(plotId, structure) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        return this.update(plotId, {
            ...plot,
            structure,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Add chapter to plot
     * @param {number} plotId
     * @param {Object} chapterData
     * @returns {Promise<Object>}
     */
    async addChapter(plotId, chapterData) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const chapter = {
            id: plot.chapters.length + 1,
            ...chapterData,
            scenes: chapterData.scenes || [],
            wordCount: 0,
            status: 'planned',
            createdAt: new Date().toISOString()
        };

        const updatedPlot = {
            ...plot,
            chapters: [...plot.chapters, chapter],
            updatedAt: new Date().toISOString()
        };

        return this.update(plotId, updatedPlot);
    }

    /**
     * Update chapter
     * @param {number} plotId
     * @param {number} chapterId
     * @param {Object} chapterData
     * @returns {Promise<Object>}
     */
    async updateChapter(plotId, chapterId, chapterData) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const updatedChapters = plot.chapters.map(ch => 
            ch.id === chapterId 
                ? { ...ch, ...chapterData, updatedAt: new Date().toISOString() }
                : ch
        );

        return this.update(plotId, {
            ...plot,
            chapters: updatedChapters,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Reorder chapters
     * @param {number} plotId
     * @param {Array<number>} chapterOrder
     * @returns {Promise<Object>}
     */
    async reorderChapters(plotId, chapterOrder) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const reorderedChapters = chapterOrder.map((chapterId, index) => {
            const chapter = plot.chapters.find(ch => ch.id === chapterId);
            return { ...chapter, order: index + 1 };
        });

        return this.update(plotId, {
            ...plot,
            chapters: reorderedChapters,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Update character arc
     * @param {number} plotId
     * @param {string} characterName
     * @param {Object} arcData
     * @returns {Promise<Object>}
     */
    async updateCharacterArc(plotId, characterName, arcData) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const updatedPlot = {
            ...plot,
            characterArcs: {
                ...plot.characterArcs,
                [characterName]: arcData
            },
            updatedAt: new Date().toISOString()
        };

        return this.update(plotId, updatedPlot);
    }

    /**
     * Add timeline event
     * @param {number} plotId
     * @param {Object} event
     * @returns {Promise<Object>}
     */
    async addTimelineEvent(plotId, event) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const timelineEvent = {
            id: Date.now(),
            ...event,
            createdAt: new Date().toISOString()
        };

        const updatedTimeline = [...plot.timeline, timelineEvent]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return this.update(plotId, {
            ...plot,
            timeline: updatedTimeline,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Update themes
     * @param {number} plotId
     * @param {Array<string>} themes
     * @returns {Promise<Object>}
     */
    async updateThemes(plotId, themes) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        return this.update(plotId, {
            ...plot,
            themes,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Add conflict
     * @param {number} plotId
     * @param {Object} conflict
     * @returns {Promise<Object>}
     */
    async addConflict(plotId, conflict) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const newConflict = {
            id: Date.now(),
            ...conflict,
            resolved: false,
            createdAt: new Date().toISOString()
        };

        return this.update(plotId, {
            ...plot,
            conflicts: [...plot.conflicts, newConflict],
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Resolve conflict
     * @param {number} plotId
     * @param {number} conflictId
     * @param {string} resolution
     * @returns {Promise<Object>}
     */
    async resolveConflict(plotId, conflictId, resolution) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const updatedConflicts = plot.conflicts.map(c => 
            c.id === conflictId 
                ? { ...c, resolved: true, resolution, resolvedAt: new Date().toISOString() }
                : c
        );

        return this.update(plotId, {
            ...plot,
            conflicts: updatedConflicts,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Get plot analysis
     * @param {number} plotId
     * @returns {Promise<Object>}
     */
    async getAnalysis(plotId) {
        const plot = await this.get(plotId);
        if (!plot) {
            throw new Error('Plot not found');
        }

        const analysis = {
            completeness: this.calculateCompleteness(plot),
            pacing: this.analyzePacing(plot),
            characterDevelopment: this.analyzeCharacterDevelopment(plot),
            conflictResolution: this.analyzeConflictResolution(plot),
            themeIntegration: this.analyzeThemeIntegration(plot),
            suggestions: this.generateSuggestions(plot)
        };

        return analysis;
    }

    // Analysis helper methods
    calculateCompleteness(plot) {
        const elements = {
            premise: plot.premise ? 1 : 0,
            structure: plot.structure ? 1 : 0,
            chapters: plot.chapters.length > 0 ? 1 : 0,
            characters: Object.keys(plot.characterArcs).length > 0 ? 1 : 0,
            themes: plot.themes.length > 0 ? 1 : 0,
            timeline: plot.timeline.length > 0 ? 1 : 0
        };

        const total = Object.values(elements).reduce((sum, val) => sum + val, 0);
        return {
            score: (total / 6) * 100,
            elements
        };
    }

    analyzePacing(plot) {
        if (!plot.chapters || plot.chapters.length === 0) {
            return { score: 0, analysis: 'No chapters defined' };
        }

        // Simple pacing analysis based on chapter structure
        const hasRisingAction = plot.chapters.some(ch => ch.type === 'rising_action');
        const hasClimax = plot.chapters.some(ch => ch.type === 'climax');
        const hasResolution = plot.chapters.some(ch => ch.type === 'resolution');

        const score = (hasRisingAction ? 33 : 0) + (hasClimax ? 34 : 0) + (hasResolution ? 33 : 0);

        return {
            score,
            hasRisingAction,
            hasClimax,
            hasResolution
        };
    }

    analyzeCharacterDevelopment(plot) {
        const characters = Object.entries(plot.characterArcs || {});
        if (characters.length === 0) {
            return { score: 0, analysis: 'No character arcs defined' };
        }

        const developedCharacters = characters.filter(([_, arc]) => 
            arc.start && arc.middle && arc.end
        ).length;

        return {
            score: (developedCharacters / characters.length) * 100,
            total: characters.length,
            developed: developedCharacters
        };
    }

    analyzeConflictResolution(plot) {
        const conflicts = plot.conflicts || [];
        if (conflicts.length === 0) {
            return { score: 100, analysis: 'No conflicts defined' };
        }

        const resolved = conflicts.filter(c => c.resolved).length;

        return {
            score: (resolved / conflicts.length) * 100,
            total: conflicts.length,
            resolved
        };
    }

    analyzeThemeIntegration(plot) {
        const themes = plot.themes || [];
        if (themes.length === 0) {
            return { score: 0, analysis: 'No themes defined' };
        }

        // Check if themes are mentioned in chapters
        let themeReferences = 0;
        plot.chapters.forEach(chapter => {
            themes.forEach(theme => {
                if (chapter.summary && chapter.summary.toLowerCase().includes(theme.toLowerCase())) {
                    themeReferences++;
                }
            });
        });

        return {
            score: Math.min((themeReferences / themes.length) * 20, 100),
            themes: themes.length,
            references: themeReferences
        };
    }

    generateSuggestions(plot) {
        const suggestions = [];

        if (!plot.premise) {
            suggestions.push({
                type: 'premise',
                priority: 'high',
                message: 'Define a clear premise for your story'
            });
        }

        if (plot.chapters.length < 5) {
            suggestions.push({
                type: 'structure',
                priority: 'medium',
                message: 'Consider adding more chapters to develop your story'
            });
        }

        if (Object.keys(plot.characterArcs).length < 2) {
            suggestions.push({
                type: 'characters',
                priority: 'medium',
                message: 'Develop arcs for supporting characters'
            });
        }

        if (plot.conflicts.length === 0) {
            suggestions.push({
                type: 'conflict',
                priority: 'high',
                message: 'Add central conflicts to drive your narrative'
            });
        }

        return suggestions;
    }
}

module.exports = PlotRepository;