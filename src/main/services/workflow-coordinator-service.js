const { EventEmitter } = require('events');
const { getLogger } = require('../utils/logger');
const agentCoordinator = require('../agents/agent-coordinator');
const { RepositoryFactory } = require('../repositories');
const { v4: uuidv4 } = require('uuid');

/**
 * Workflow phases
 */
const WORKFLOW_PHASES = {
    PROJECT_SETUP: 'project_setup',
    PLOT_CREATION: 'plot_creation',
    WRITING_SESSION: 'writing_session',
    REVIEW_REFINEMENT: 'review_refinement',
    COMPLETE: 'complete'
};

/**
 * WorkflowCoordinatorService - Manages the entire creative workflow
 */
class WorkflowCoordinatorService extends EventEmitter {
    constructor() {
        super();
        this.logger = getLogger('workflow-coordinator');
        this.activeWorkflows = new Map();
        this.repositories = null; // Will be initialized with database
    }

    /**
     * Initialize with database
     * @param {Object} db - Database instance
     */
    initialize(db) {
        this.repositories = new RepositoryFactory(db);
        this.logger.info('Workflow coordinator initialized with database');
    }

    /**
     * Start a new workflow for a project
     * @param {number} projectId
     * @param {Object} options
     * @returns {Object} Workflow instance
     */
    async startWorkflow(projectId, options = {}) {
        try {
            if (!this.repositories) {
                throw new Error('Workflow coordinator not initialized');
            }
            
            const project = this.repositories.projects.get(projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            const workflowId = uuidv4();
            const workflow = {
                id: workflowId,
                projectId,
                projectName: project.name,
                currentPhase: WORKFLOW_PHASES.PROJECT_SETUP,
                phases: {
                    [WORKFLOW_PHASES.PROJECT_SETUP]: {
                        status: 'completed',
                        completedAt: new Date()
                    },
                    [WORKFLOW_PHASES.PLOT_CREATION]: {
                        status: 'pending',
                        sessionId: null,
                        plotId: null
                    },
                    [WORKFLOW_PHASES.WRITING_SESSION]: {
                        status: 'pending',
                        chaptersCompleted: 0,
                        targetChapters: options.targetChapters || 10
                    },
                    [WORKFLOW_PHASES.REVIEW_REFINEMENT]: {
                        status: 'pending'
                    },
                    [WORKFLOW_PHASES.COMPLETE]: {
                        status: 'pending'
                    }
                },
                options,
                startedAt: new Date(),
                metadata: {
                    autoTransition: options.autoTransition !== false,
                    participants: options.participants || ['deputy_editor', 'writer', 'editor', 'proofreader']
                }
            };

            this.activeWorkflows.set(workflowId, workflow);
            
            // Emit workflow started event
            this.emit('workflow:started', {
                workflowId,
                projectId,
                projectName: project.name
            });

            this.logger.info(`Started workflow ${workflowId} for project ${projectId}`);
            
            return workflow;
        } catch (error) {
            this.logger.error('Failed to start workflow:', error);
            throw error;
        }
    }

    /**
     * Transition to next phase
     * @param {string} workflowId
     * @returns {Object} Updated workflow
     */
    async transitionToNextPhase(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }

        const currentPhaseIndex = Object.keys(WORKFLOW_PHASES).findIndex(
            key => WORKFLOW_PHASES[key] === workflow.currentPhase
        );

        if (currentPhaseIndex === -1 || currentPhaseIndex >= Object.keys(WORKFLOW_PHASES).length - 1) {
            this.logger.warn(`Cannot transition from phase ${workflow.currentPhase}`);
            return workflow;
        }

        const nextPhaseKey = Object.keys(WORKFLOW_PHASES)[currentPhaseIndex + 1];
        const nextPhase = WORKFLOW_PHASES[nextPhaseKey];

        // Complete current phase
        workflow.phases[workflow.currentPhase].status = 'completed';
        workflow.phases[workflow.currentPhase].completedAt = new Date();

        // Start next phase
        workflow.currentPhase = nextPhase;
        workflow.phases[nextPhase].status = 'in_progress';
        workflow.phases[nextPhase].startedAt = new Date();

        // Emit phase transition event
        this.emit('workflow:phase-transitioned', {
            workflowId,
            fromPhase: WORKFLOW_PHASES[Object.keys(WORKFLOW_PHASES)[currentPhaseIndex]],
            toPhase: nextPhase,
            workflow
        });

        // Handle phase-specific initialization
        await this.initializePhase(workflow, nextPhase);

        this.logger.info(`Workflow ${workflowId} transitioned to phase ${nextPhase}`);
        
        return workflow;
    }

    /**
     * Initialize phase-specific operations
     * @param {Object} workflow
     * @param {string} phase
     */
    async initializePhase(workflow, phase) {
        switch (phase) {
            case WORKFLOW_PHASES.PLOT_CREATION:
                await this.initializePlotCreation(workflow);
                break;
            case WORKFLOW_PHASES.WRITING_SESSION:
                await this.initializeWritingSession(workflow);
                break;
            case WORKFLOW_PHASES.REVIEW_REFINEMENT:
                await this.initializeReviewRefinement(workflow);
                break;
            case WORKFLOW_PHASES.COMPLETE:
                await this.completeWorkflow(workflow);
                break;
        }
    }

    /**
     * Initialize plot creation phase
     * @param {Object} workflow
     */
    async initializePlotCreation(workflow) {
        try {
            // Start agent session for plot creation
            const sessionId = uuidv4();
            const session = await agentCoordinator.startSession(sessionId, {
                type: 'plot_creation',
                participants: workflow.metadata.participants.map(p => {
                    switch(p) {
                        case 'deputy_editor': return 'deputy-editor-1';
                        case 'writer': return 'writer-1';
                        case 'editor': return 'editor-1';
                        case 'proofreader': return 'proofreader-1';
                        default: return null;
                    }
                }).filter(Boolean)
            });

            workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].sessionId = sessionId;

            // Emit event for UI update
            this.emit('workflow:plot-creation-started', {
                workflowId: workflow.id,
                sessionId,
                projectId: workflow.projectId
            });

            // Start automated plot discussion
            if (workflow.metadata.autoTransition) {
                setTimeout(() => {
                    this.automatedPlotDiscussion(workflow, sessionId);
                }, 2000);
            }

        } catch (error) {
            this.logger.error('Failed to initialize plot creation:', error);
            workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].status = 'failed';
            workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].error = error.message;
            throw error;
        }
    }

    /**
     * Run automated plot discussion
     * @param {Object} workflow
     * @param {string} sessionId
     */
    async automatedPlotDiscussion(workflow, sessionId) {
        try {
            const plotPrompts = [
                {
                    aspect: 'themes',
                    message: 'Let\'s start by discussing the main themes for this story. What universal themes would resonate with readers?'
                },
                {
                    aspect: 'premise',
                    message: 'Based on the themes, what would be a compelling premise for our story? What\'s the core concept?'
                },
                {
                    aspect: 'characters',
                    message: 'Who are our main characters? Let\'s develop compelling protagonists and antagonists.'
                },
                {
                    aspect: 'setting',
                    message: 'Where and when does our story take place? Let\'s create an immersive setting.'
                },
                {
                    aspect: 'conflicts',
                    message: 'What are the main conflicts that will drive our story forward?'
                },
                {
                    aspect: 'structure',
                    message: 'How should we structure the story? What are the key plot points and story arc?'
                }
            ];

            // Process each plot aspect
            for (const prompt of plotPrompts) {
                await this.processPlotPrompt(workflow, sessionId, prompt);
                
                // Wait between prompts to allow agents to respond
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Generate final plot
            await new Promise(resolve => setTimeout(resolve, 3000));
            const plot = await agentCoordinator.generateFinalPlot(sessionId);

            // Save plot to project
            const savedPlot = this.repositories.plots.create({
                ...plot,
                project_id: workflow.projectId
            });

            workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].plotId = savedPlot.id;

            // Emit plot completed event
            this.emit('workflow:plot-completed', {
                workflowId: workflow.id,
                plotId: savedPlot.id,
                plot: savedPlot
            });

            // Auto-transition to writing phase if enabled
            if (workflow.metadata.autoTransition) {
                await this.transitionToNextPhase(workflow.id);
            }

        } catch (error) {
            this.logger.error('Failed during automated plot discussion:', error);
            workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].status = 'failed';
            workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].error = error.message;
        }
    }

    /**
     * Process a single plot prompt
     * @param {Object} workflow
     * @param {string} sessionId
     * @param {Object} prompt
     */
    async processPlotPrompt(workflow, sessionId, prompt) {
        try {
            await agentCoordinator.discussPlotCreation({
                sessionId,
                message: prompt.message,
                context: { projectId: workflow.projectId },
                plotAspect: prompt.aspect
            });

            // Emit progress event
            this.emit('workflow:plot-progress', {
                workflowId: workflow.id,
                aspect: prompt.aspect,
                message: prompt.message
            });

        } catch (error) {
            this.logger.error(`Failed to process plot prompt for ${prompt.aspect}:`, error);
            throw error;
        }
    }

    /**
     * Initialize writing session phase
     * @param {Object} workflow
     */
    async initializeWritingSession(workflow) {
        try {
            const plotId = workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].plotId;
            if (!plotId) {
                throw new Error('No plot available for writing session');
            }

            const plot = this.repositories.plots.get(plotId);
            if (!plot) {
                throw new Error('Plot not found');
            }

            // Create writing session
            const sessionId = uuidv4();
            const session = await agentCoordinator.startSession(sessionId, {
                type: 'chapter_writing',
                participants: workflow.metadata.participants.map(p => {
                    switch(p) {
                        case 'deputy_editor': return 'deputy-editor-1';
                        case 'writer': return 'writer-1';
                        case 'editor': return 'editor-1';
                        case 'proofreader': return 'proofreader-1';
                        default: return null;
                    }
                }).filter(Boolean)
            });

            workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].sessionId = sessionId;
            workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].plot = plot;

            // Emit event
            this.emit('workflow:writing-started', {
                workflowId: workflow.id,
                sessionId,
                plotId,
                targetChapters: workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].targetChapters
            });

            // Start automated chapter writing if enabled
            if (workflow.metadata.autoTransition) {
                setTimeout(() => {
                    this.automatedChapterWriting(workflow, sessionId, plot);
                }, 2000);
            }

        } catch (error) {
            this.logger.error('Failed to initialize writing session:', error);
            workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].status = 'failed';
            workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].error = error.message;
            throw error;
        }
    }

    /**
     * Run automated chapter writing
     * @param {Object} workflow
     * @param {string} sessionId
     * @param {Object} plot
     */
    async automatedChapterWriting(workflow, sessionId, plot) {
        try {
            const targetChapters = workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].targetChapters;
            const chapters = plot.chapters || this.generateChaptersFromPlot(plot, targetChapters);

            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];
                
                // Discuss chapter outline
                await agentCoordinator.discussTopic({
                    sessionId,
                    topic: 'chapter_outline',
                    content: `Let's write Chapter ${i + 1}: ${chapter.title}. ${chapter.summary}`,
                    context: {
                        projectId: workflow.projectId,
                        plotId: plot.id,
                        chapterNumber: i + 1,
                        previousChapters: i > 0 ? chapters.slice(0, i) : []
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 3000));

                // Write chapter content
                await agentCoordinator.discussTopic({
                    sessionId,
                    topic: 'chapter_content',
                    content: 'Now let\'s write the actual content for this chapter. Focus on vivid descriptions, engaging dialogue, and advancing the plot.',
                    context: {
                        chapterOutline: chapter,
                        plotContext: plot
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 5000));

                // Save chapter
                const savedChapter = this.repositories.chapters.create({
                    project_id: workflow.projectId,
                    plot_id: plot.id,
                    chapter_number: i + 1,
                    title: chapter.title,
                    content: `Chapter ${i + 1}: ${chapter.title}\n\n[AI-generated chapter content would go here]`,
                    word_count: Math.floor(Math.random() * 2000) + 1500,
                    status: 'draft'
                });

                workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].chaptersCompleted = i + 1;

                // Emit progress
                this.emit('workflow:chapter-completed', {
                    workflowId: workflow.id,
                    chapterNumber: i + 1,
                    chapterId: savedChapter.id,
                    totalChapters: targetChapters,
                    progress: ((i + 1) / targetChapters) * 100
                });

                // Break between chapters
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Auto-transition to review phase if enabled
            if (workflow.metadata.autoTransition) {
                await this.transitionToNextPhase(workflow.id);
            }

        } catch (error) {
            this.logger.error('Failed during automated chapter writing:', error);
            workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].status = 'failed';
            workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].error = error.message;
        }
    }

    /**
     * Generate chapters from plot
     * @param {Object} plot
     * @param {number} targetChapters
     * @returns {Array}
     */
    generateChaptersFromPlot(plot, targetChapters) {
        const chapters = [];
        const acts = plot.structure?.acts || [
            { name: 'Beginning', description: 'Setup' },
            { name: 'Middle', description: 'Development' },
            { name: 'End', description: 'Resolution' }
        ];

        const chaptersPerAct = Math.ceil(targetChapters / acts.length);

        acts.forEach((act, actIndex) => {
            for (let i = 0; i < chaptersPerAct && chapters.length < targetChapters; i++) {
                chapters.push({
                    title: `Chapter ${chapters.length + 1}`,
                    summary: `Part of ${act.name}: ${act.description}`,
                    act: actIndex + 1,
                    plotPoints: []
                });
            }
        });

        return chapters;
    }

    /**
     * Initialize review refinement phase
     * @param {Object} workflow
     */
    async initializeReviewRefinement(workflow) {
        try {
            // Get all chapters for review
            const chapters = this.repositories.chapters.findByProject(workflow.projectId);

            // Create review session
            const sessionId = uuidv4();
            const session = await agentCoordinator.startSession(sessionId, {
                type: 'review_discussion',
                participants: ['deputy-editor-1', 'editor-1', 'proofreader-1']
            });

            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].sessionId = sessionId;
            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].chaptersToReview = chapters.length;

            // Emit event
            this.emit('workflow:review-started', {
                workflowId: workflow.id,
                sessionId,
                chaptersToReview: chapters.length
            });

            // Start automated review if enabled
            if (workflow.metadata.autoTransition) {
                setTimeout(() => {
                    this.automatedReview(workflow, sessionId, chapters);
                }, 2000);
            }

        } catch (error) {
            this.logger.error('Failed to initialize review refinement:', error);
            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].status = 'failed';
            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].error = error.message;
            throw error;
        }
    }

    /**
     * Run automated review
     * @param {Object} workflow
     * @param {string} sessionId
     * @param {Array} chapters
     */
    async automatedReview(workflow, sessionId, chapters) {
        try {
            // Review overall structure
            await agentCoordinator.discussTopic({
                sessionId,
                topic: 'structural_review',
                content: 'Let\'s review the overall structure and flow of the story. Does it maintain good pacing and coherence?',
                context: {
                    chapterCount: chapters.length,
                    totalWordCount: chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0)
                }
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Review character consistency
            await agentCoordinator.discussTopic({
                sessionId,
                topic: 'character_consistency',
                content: 'Are the characters consistent throughout the story? Do they show proper development?',
                context: { projectId: workflow.projectId }
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Final recommendations
            await agentCoordinator.discussTopic({
                sessionId,
                topic: 'final_recommendations',
                content: 'What are your final recommendations for improving this manuscript?',
                context: { projectId: workflow.projectId }
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Mark review as complete
            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].reviewCompleted = true;

            // Auto-transition to complete phase if enabled
            if (workflow.metadata.autoTransition) {
                await this.transitionToNextPhase(workflow.id);
            }

        } catch (error) {
            this.logger.error('Failed during automated review:', error);
            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].status = 'failed';
            workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].error = error.message;
        }
    }

    /**
     * Complete the workflow
     * @param {Object} workflow
     */
    async completeWorkflow(workflow) {
        workflow.completedAt = new Date();
        workflow.phases[WORKFLOW_PHASES.COMPLETE].status = 'completed';
        workflow.phases[WORKFLOW_PHASES.COMPLETE].completedAt = new Date();

        // Calculate total duration
        const duration = workflow.completedAt - workflow.startedAt;

        // Update project status
        this.repositories.projects.update(workflow.projectId, {
            status: 'completed',
            workflow_completed_at: workflow.completedAt
        });

        // Emit completion event
        this.emit('workflow:completed', {
            workflowId: workflow.id,
            projectId: workflow.projectId,
            duration,
            stats: this.calculateWorkflowStats(workflow)
        });

        this.logger.info(`Workflow ${workflow.id} completed successfully`);
    }

    /**
     * Calculate workflow statistics
     * @param {Object} workflow
     * @returns {Object}
     */
    calculateWorkflowStats(workflow) {
        return {
            totalDuration: workflow.completedAt - workflow.startedAt,
            plotCreationDuration: workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].completedAt - workflow.phases[WORKFLOW_PHASES.PLOT_CREATION].startedAt,
            writingDuration: workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].completedAt - workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].startedAt,
            chaptersWritten: workflow.phases[WORKFLOW_PHASES.WRITING_SESSION].chaptersCompleted,
            reviewDuration: workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].completedAt - workflow.phases[WORKFLOW_PHASES.REVIEW_REFINEMENT].startedAt
        };
    }

    /**
     * Get workflow by ID
     * @param {string} workflowId
     * @returns {Object}
     */
    getWorkflow(workflowId) {
        return this.activeWorkflows.get(workflowId);
    }

    /**
     * Get workflows for a project
     * @param {number} projectId
     * @returns {Array}
     */
    getProjectWorkflows(projectId) {
        return Array.from(this.activeWorkflows.values()).filter(w => w.projectId === projectId);
    }

    /**
     * Pause workflow
     * @param {string} workflowId
     */
    pauseWorkflow(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (workflow) {
            workflow.paused = true;
            workflow.pausedAt = new Date();
            this.emit('workflow:paused', { workflowId });
        }
    }

    /**
     * Resume workflow
     * @param {string} workflowId
     */
    resumeWorkflow(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (workflow && workflow.paused) {
            workflow.paused = false;
            workflow.resumedAt = new Date();
            this.emit('workflow:resumed', { workflowId });
        }
    }

    /**
     * Cancel workflow
     * @param {string} workflowId
     */
    cancelWorkflow(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (workflow) {
            workflow.cancelled = true;
            workflow.cancelledAt = new Date();
            this.activeWorkflows.delete(workflowId);
            this.emit('workflow:cancelled', { workflowId });
        }
    }
}

// Export singleton instance
module.exports = new WorkflowCoordinatorService();