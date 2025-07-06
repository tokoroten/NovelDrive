const { EventEmitter } = require('events');
const { getLogger } = require('../utils/logger');
const coordinator = require('../agents/agent-coordinator');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

/**
 * Autonomous Service - Manages 24-hour autonomous creation sessions
 */
class AutonomousService extends EventEmitter {
    constructor() {
        super();
        
        this.logger = getLogger();
        this.sessions = new Map();
        this.activeSession = null;
        this.isRunning = false;
        
        // Constants
        this.MAX_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms
        this.CHECKPOINT_INTERVAL = 15 * 60 * 1000; // Save progress every 15 minutes
        this.ACTIVITY_DURATION = {
            writing: 45 * 60 * 1000,      // 45 minutes
            brainstorming: 30 * 60 * 1000, // 30 minutes
            reviewing: 30 * 60 * 1000,     // 30 minutes
            plotting: 45 * 60 * 1000,      // 45 minutes
            character: 30 * 60 * 1000,     // 30 minutes
            worldbuilding: 45 * 60 * 1000, // 45 minutes
            rest: 15 * 60 * 1000           // 15 minute break
        };
        
        // API usage tracking
        this.apiUsage = {
            requests: 0,
            tokensUsed: 0,
            lastReset: new Date()
        };
        
        this.API_LIMITS = {
            maxRequestsPerHour: 100,
            maxTokensPerHour: 100000,
            maxRequestsPerSession: 500,
            maxTokensPerSession: 500000
        };
    }

    /**
     * Start autonomous session
     * @param {Object} config Session configuration
     * @returns {Object} Session info
     */
    async startSession(config) {
        if (this.activeSession) {
            throw new Error('An autonomous session is already active');
        }

        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            projectId: config.projectId,
            schedule: config.schedule || 'balanced',
            startTime: new Date(),
            endTime: null,
            status: 'active',
            activities: [],
            outputs: [],
            checkpoints: [],
            metrics: {
                wordsWritten: 0,
                chaptersCompleted: 0,
                ideasGenerated: 0,
                revisionsCompleted: 0
            },
            config: config
        };

        this.sessions.set(sessionId, session);
        this.activeSession = session;
        this.isRunning = true;

        this.logger.info(`Starting autonomous session: ${sessionId}`);
        this.emit('session:started', session);

        // Load schedule
        const schedule = await this.loadSchedule(config.schedule);
        
        // Start session loop
        this.runSessionLoop(session, schedule);
        
        // Start checkpoint timer
        this.startCheckpointTimer(session);

        return {
            sessionId,
            status: 'started',
            schedule: schedule.name
        };
    }

    /**
     * Pause autonomous session
     */
    async pauseSession() {
        if (!this.activeSession) {
            throw new Error('No active session to pause');
        }

        this.isRunning = false;
        this.activeSession.status = 'paused';
        
        // Save checkpoint
        await this.saveCheckpoint(this.activeSession);
        
        this.logger.info(`Paused session: ${this.activeSession.id}`);
        this.emit('session:paused', this.activeSession);

        return {
            sessionId: this.activeSession.id,
            status: 'paused'
        };
    }

    /**
     * Resume autonomous session
     */
    async resumeSession() {
        if (!this.activeSession || this.activeSession.status !== 'paused') {
            throw new Error('No paused session to resume');
        }

        this.isRunning = true;
        this.activeSession.status = 'active';
        
        // Reload schedule
        const schedule = await this.loadSchedule(this.activeSession.config.schedule);
        
        // Resume session loop
        this.runSessionLoop(this.activeSession, schedule);
        
        this.logger.info(`Resumed session: ${this.activeSession.id}`);
        this.emit('session:resumed', this.activeSession);

        return {
            sessionId: this.activeSession.id,
            status: 'resumed'
        };
    }

    /**
     * Stop autonomous session
     */
    async stopSession() {
        if (!this.activeSession) {
            throw new Error('No active session to stop');
        }

        this.isRunning = false;
        this.activeSession.status = 'completed';
        this.activeSession.endTime = new Date();
        
        // Save final checkpoint
        await this.saveCheckpoint(this.activeSession);
        
        // Generate session report
        const report = await this.generateSessionReport(this.activeSession);
        
        this.logger.info(`Stopped session: ${this.activeSession.id}`);
        this.emit('session:completed', {
            session: this.activeSession,
            report
        });

        this.activeSession = null;

        return {
            sessionId: this.activeSession?.id,
            status: 'stopped',
            report
        };
    }

    /**
     * Run session loop
     * @param {Object} session
     * @param {Object} schedule
     */
    async runSessionLoop(session, schedule) {
        let activityIndex = 0;
        
        while (this.isRunning && session.status === 'active') {
            // Check session duration limit
            const elapsed = Date.now() - session.startTime.getTime();
            if (elapsed >= this.MAX_SESSION_DURATION) {
                this.logger.info('Session reached 24-hour limit');
                await this.stopSession();
                break;
            }

            // Check API limits
            if (this.isApiLimitReached()) {
                this.logger.warn('API limit reached, entering rest period');
                await this.executeRestPeriod(session, 30 * 60 * 1000); // 30 min rest
                this.resetHourlyLimits();
                continue;
            }

            // Get next activity
            const activity = schedule.activities[activityIndex % schedule.activities.length];
            
            try {
                await this.executeActivity(session, activity);
                activityIndex++;
            } catch (error) {
                this.logger.error(`Error executing activity ${activity.type}:`, error);
                this.emit('activity:error', {
                    sessionId: session.id,
                    activity,
                    error: error.message
                });
            }

            // Small delay between activities
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    /**
     * Execute activity
     * @param {Object} session
     * @param {Object} activity
     */
    async executeActivity(session, activity) {
        const startTime = new Date();
        
        this.logger.info(`Starting activity: ${activity.type}`);
        this.emit('activity:started', {
            sessionId: session.id,
            activity: activity.type,
            startTime
        });

        // Record activity
        session.activities.push({
            type: activity.type,
            startTime,
            endTime: null,
            outputs: []
        });

        // Execute based on activity type
        let result;
        switch (activity.type) {
            case 'writing':
                result = await this.executeWritingActivity(session, activity);
                break;
            case 'brainstorming':
                result = await this.executeBrainstormingActivity(session, activity);
                break;
            case 'reviewing':
                result = await this.executeReviewingActivity(session, activity);
                break;
            case 'plotting':
                result = await this.executePlottingActivity(session, activity);
                break;
            case 'character':
                result = await this.executeCharacterActivity(session, activity);
                break;
            case 'worldbuilding':
                result = await this.executeWorldbuildingActivity(session, activity);
                break;
            case 'rest':
                await this.executeRestPeriod(session, activity.duration || this.ACTIVITY_DURATION.rest);
                result = { type: 'rest', duration: activity.duration };
                break;
            default:
                throw new Error(`Unknown activity type: ${activity.type}`);
        }

        // Update activity record
        const currentActivity = session.activities[session.activities.length - 1];
        currentActivity.endTime = new Date();
        currentActivity.outputs = result.outputs || [];

        // Update metrics
        this.updateSessionMetrics(session, result);

        // Store outputs
        if (result.outputs && result.outputs.length > 0) {
            session.outputs.push(...result.outputs);
        }

        this.emit('activity:completed', {
            sessionId: session.id,
            activity: activity.type,
            duration: currentActivity.endTime - currentActivity.startTime,
            result
        });
    }

    /**
     * Execute writing activity
     */
    async executeWritingActivity(session, activity) {
        const sessionId = uuidv4();
        const agents = ['writer', 'editor', 'proofreader'];
        
        // Start collaborative writing session
        await coordinator.startSession(sessionId, {
            type: 'writing',
            participants: agents
        });

        const outputs = [];
        const duration = activity.duration || this.ACTIVITY_DURATION.writing;
        const endTime = Date.now() + duration;

        // Determine writing focus based on project state
        const writingTopics = await this.generateWritingTopics(session);

        let topicIndex = 0;
        while (Date.now() < endTime && this.isRunning) {
            const topic = writingTopics[topicIndex % writingTopics.length];
            
            try {
                const results = await coordinator.discussTopic({
                    sessionId,
                    topic: topic.type,
                    content: topic.content,
                    context: topic.context
                });

                // Track API usage
                this.trackApiUsage(results);

                // Collect outputs
                results.forEach(result => {
                    if (result.contribution && result.contribution.content) {
                        outputs.push({
                            type: 'writing',
                            agentId: result.agentId,
                            content: result.contribution.content,
                            metadata: {
                                topic: topic.type,
                                timestamp: new Date()
                            }
                        });
                    }
                });

                topicIndex++;
                
                // Short break between topics
                await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
            } catch (error) {
                this.logger.error('Error in writing activity:', error);
            }
        }

        // End session
        coordinator.endSession(sessionId);

        return {
            type: 'writing',
            outputs,
            metrics: {
                topicsCovered: topicIndex,
                outputsGenerated: outputs.length
            }
        };
    }

    /**
     * Execute brainstorming activity
     */
    async executeBrainstormingActivity(session, activity) {
        const sessionId = uuidv4();
        const agents = ['writer', 'editor', 'deputy-editor'];
        
        await coordinator.startSession(sessionId, {
            type: 'brainstorming',
            participants: agents
        });

        const outputs = [];
        const duration = activity.duration || this.ACTIVITY_DURATION.brainstorming;
        const endTime = Date.now() + duration;

        // Generate brainstorming topics
        const topics = await this.generateBrainstormingTopics(session);

        let topicIndex = 0;
        while (Date.now() < endTime && this.isRunning) {
            const topic = topics[topicIndex % topics.length];
            
            try {
                const results = await coordinator.discussTopic({
                    sessionId,
                    topic: 'brainstorming',
                    content: topic.prompt,
                    context: {
                        projectId: session.projectId,
                        focusArea: topic.area
                    }
                });

                this.trackApiUsage(results);

                results.forEach(result => {
                    if (result.contribution && result.contribution.ideas) {
                        outputs.push({
                            type: 'brainstorming',
                            agentId: result.agentId,
                            content: result.contribution.ideas,
                            metadata: {
                                area: topic.area,
                                timestamp: new Date()
                            }
                        });
                    }
                });

                topicIndex++;
                await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
            } catch (error) {
                this.logger.error('Error in brainstorming activity:', error);
            }
        }

        coordinator.endSession(sessionId);

        return {
            type: 'brainstorming',
            outputs,
            metrics: {
                ideasGenerated: outputs.reduce((sum, o) => sum + (o.content?.length || 0), 0),
                topicsCovered: topicIndex
            }
        };
    }

    /**
     * Execute reviewing activity
     */
    async executeReviewingActivity(session, activity) {
        const sessionId = uuidv4();
        const agents = ['editor', 'proofreader', 'deputy-editor'];
        
        await coordinator.startSession(sessionId, {
            type: 'reviewing',
            participants: agents
        });

        const outputs = [];
        const duration = activity.duration || this.ACTIVITY_DURATION.reviewing;
        
        // Get recent outputs to review
        const recentOutputs = session.outputs
            .filter(o => o.type === 'writing')
            .slice(-10); // Review last 10 writing outputs

        for (const output of recentOutputs) {
            if (!this.isRunning) break;
            
            try {
                const results = await coordinator.discussTopic({
                    sessionId,
                    topic: 'review',
                    content: output.content,
                    context: {
                        originalType: output.type,
                        metadata: output.metadata
                    }
                });

                this.trackApiUsage(results);

                results.forEach(result => {
                    if (result.contribution && result.contribution.feedback) {
                        outputs.push({
                            type: 'review',
                            agentId: result.agentId,
                            content: result.contribution.feedback,
                            metadata: {
                                reviewedOutput: output.metadata,
                                timestamp: new Date()
                            }
                        });
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds
            } catch (error) {
                this.logger.error('Error in reviewing activity:', error);
            }
        }

        coordinator.endSession(sessionId);

        return {
            type: 'reviewing',
            outputs,
            metrics: {
                outputsReviewed: recentOutputs.length,
                feedbackGenerated: outputs.length
            }
        };
    }

    /**
     * Execute plotting activity
     */
    async executePlottingActivity(session, activity) {
        const sessionId = uuidv4();
        const agents = ['writer', 'editor', 'deputy-editor'];
        
        await coordinator.startSession(sessionId, {
            type: 'plotting',
            participants: agents
        });

        const outputs = [];
        const duration = activity.duration || this.ACTIVITY_DURATION.plotting;
        const endTime = Date.now() + duration;

        const plotTopics = [
            { area: 'story-arc', prompt: 'Develop the main story arc and key turning points' },
            { area: 'subplot', prompt: 'Create compelling subplots that enhance the main story' },
            { area: 'conflict', prompt: 'Design conflicts and obstacles for characters' },
            { area: 'resolution', prompt: 'Plan satisfying resolutions and payoffs' }
        ];

        let topicIndex = 0;
        while (Date.now() < endTime && this.isRunning) {
            const topic = plotTopics[topicIndex % plotTopics.length];
            
            try {
                const results = await coordinator.discussTopic({
                    sessionId,
                    topic: 'plotting',
                    content: topic.prompt,
                    context: {
                        projectId: session.projectId,
                        plotArea: topic.area
                    }
                });

                this.trackApiUsage(results);

                results.forEach(result => {
                    if (result.contribution) {
                        outputs.push({
                            type: 'plotting',
                            agentId: result.agentId,
                            content: result.contribution,
                            metadata: {
                                area: topic.area,
                                timestamp: new Date()
                            }
                        });
                    }
                });

                topicIndex++;
                await new Promise(resolve => setTimeout(resolve, 25000)); // 25 seconds
            } catch (error) {
                this.logger.error('Error in plotting activity:', error);
            }
        }

        coordinator.endSession(sessionId);

        return {
            type: 'plotting',
            outputs,
            metrics: {
                plotPointsGenerated: outputs.length,
                areasExplored: Math.min(topicIndex, plotTopics.length)
            }
        };
    }

    /**
     * Execute character development activity
     */
    async executeCharacterActivity(session, activity) {
        const sessionId = uuidv4();
        const agents = ['writer', 'editor'];
        
        await coordinator.startSession(sessionId, {
            type: 'character',
            participants: agents
        });

        const outputs = [];
        const duration = activity.duration || this.ACTIVITY_DURATION.character;
        
        const characterTopics = [
            { aspect: 'backstory', prompt: 'Develop rich character backstories and histories' },
            { aspect: 'motivation', prompt: 'Define character goals, desires, and motivations' },
            { aspect: 'relationships', prompt: 'Create complex character relationships and dynamics' },
            { aspect: 'growth', prompt: 'Plan character arcs and development throughout the story' }
        ];

        for (const topic of characterTopics) {
            if (!this.isRunning) break;
            
            try {
                const results = await coordinator.discussTopic({
                    sessionId,
                    topic: 'character-development',
                    content: topic.prompt,
                    context: {
                        projectId: session.projectId,
                        aspect: topic.aspect
                    }
                });

                this.trackApiUsage(results);

                results.forEach(result => {
                    if (result.contribution) {
                        outputs.push({
                            type: 'character',
                            agentId: result.agentId,
                            content: result.contribution,
                            metadata: {
                                aspect: topic.aspect,
                                timestamp: new Date()
                            }
                        });
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
            } catch (error) {
                this.logger.error('Error in character activity:', error);
            }
        }

        coordinator.endSession(sessionId);

        return {
            type: 'character',
            outputs,
            metrics: {
                charactersExplored: outputs.length,
                aspectsCovered: characterTopics.filter((_, i) => i < outputs.length).length
            }
        };
    }

    /**
     * Execute worldbuilding activity
     */
    async executeWorldbuildingActivity(session, activity) {
        const sessionId = uuidv4();
        const agents = ['writer', 'editor', 'deputy-editor'];
        
        await coordinator.startSession(sessionId, {
            type: 'worldbuilding',
            participants: agents
        });

        const outputs = [];
        const duration = activity.duration || this.ACTIVITY_DURATION.worldbuilding;
        
        const worldTopics = [
            { element: 'setting', prompt: 'Develop detailed settings and locations' },
            { element: 'culture', prompt: 'Create cultures, societies, and social structures' },
            { element: 'history', prompt: 'Build historical context and past events' },
            { element: 'rules', prompt: 'Define the rules and systems of your world' }
        ];

        for (const topic of worldTopics) {
            if (!this.isRunning) break;
            
            try {
                const results = await coordinator.discussTopic({
                    sessionId,
                    topic: 'worldbuilding',
                    content: topic.prompt,
                    context: {
                        projectId: session.projectId,
                        element: topic.element
                    }
                });

                this.trackApiUsage(results);

                results.forEach(result => {
                    if (result.contribution) {
                        outputs.push({
                            type: 'worldbuilding',
                            agentId: result.agentId,
                            content: result.contribution,
                            metadata: {
                                element: topic.element,
                                timestamp: new Date()
                            }
                        });
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
            } catch (error) {
                this.logger.error('Error in worldbuilding activity:', error);
            }
        }

        coordinator.endSession(sessionId);

        return {
            type: 'worldbuilding',
            outputs,
            metrics: {
                elementsCreated: outputs.length,
                worldAspectsCovered: worldTopics.filter((_, i) => i < outputs.length).length
            }
        };
    }

    /**
     * Execute rest period
     */
    async executeRestPeriod(session, duration) {
        this.logger.info(`Entering rest period for ${duration / 1000 / 60} minutes`);
        
        this.emit('rest:started', {
            sessionId: session.id,
            duration
        });

        // Save checkpoint before rest
        await this.saveCheckpoint(session);

        // Wait for rest duration or until stopped
        const endTime = Date.now() + duration;
        while (Date.now() < endTime && this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
        }

        this.emit('rest:completed', {
            sessionId: session.id
        });
    }

    /**
     * Load schedule template
     */
    async loadSchedule(scheduleName) {
        const schedulePath = path.join(__dirname, '..', 'schedules', `${scheduleName}.json`);
        
        try {
            const data = await fs.readFile(schedulePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            this.logger.warn(`Schedule ${scheduleName} not found, using default`);
            return this.getDefaultSchedule();
        }
    }

    /**
     * Get default balanced schedule
     */
    getDefaultSchedule() {
        return {
            name: 'balanced',
            description: 'A balanced schedule with all activity types',
            activities: [
                { type: 'brainstorming', duration: this.ACTIVITY_DURATION.brainstorming },
                { type: 'plotting', duration: this.ACTIVITY_DURATION.plotting },
                { type: 'writing', duration: this.ACTIVITY_DURATION.writing },
                { type: 'rest', duration: this.ACTIVITY_DURATION.rest },
                { type: 'character', duration: this.ACTIVITY_DURATION.character },
                { type: 'writing', duration: this.ACTIVITY_DURATION.writing },
                { type: 'reviewing', duration: this.ACTIVITY_DURATION.reviewing },
                { type: 'rest', duration: this.ACTIVITY_DURATION.rest },
                { type: 'worldbuilding', duration: this.ACTIVITY_DURATION.worldbuilding },
                { type: 'writing', duration: this.ACTIVITY_DURATION.writing }
            ]
        };
    }

    /**
     * Generate writing topics based on project state
     */
    async generateWritingTopics(session) {
        const projectContext = {
            projectId: session.projectId,
            recentOutputs: session.outputs.slice(-10),
            currentChapter: null, // This could be loaded from the database
            plotPoints: [] // This could be loaded from the database
        };
        
        const topics = [];
        for (let i = 0; i < 5; i++) {
            const topic = await coordinator.generateAutonomousTopic(projectContext, 'writing');
            topics.push({
                type: topic.type || 'writing',
                content: topic.prompt,
                context: topic
            });
        }
        
        return topics;
    }

    /**
     * Generate brainstorming topics
     */
    async generateBrainstormingTopics(session) {
        const projectContext = {
            projectId: session.projectId,
            recentOutputs: session.outputs.slice(-10),
            plotPoints: []
        };
        
        const topics = [];
        for (let i = 0; i < 4; i++) {
            const topic = await coordinator.generateAutonomousTopic(projectContext, 'brainstorming');
            topics.push(topic);
        }
        
        return topics;
    }

    /**
     * Start checkpoint timer
     */
    startCheckpointTimer(session) {
        const checkpointInterval = setInterval(async () => {
            if (!this.isRunning || this.activeSession?.id !== session.id) {
                clearInterval(checkpointInterval);
                return;
            }

            await this.saveCheckpoint(session);
        }, this.CHECKPOINT_INTERVAL);
    }

    /**
     * Save checkpoint
     */
    async saveCheckpoint(session) {
        const checkpoint = {
            timestamp: new Date(),
            activities: session.activities.length,
            outputs: session.outputs.length,
            metrics: { ...session.metrics },
            apiUsage: { ...this.apiUsage }
        };

        session.checkpoints.push(checkpoint);
        
        // Save outputs to disk
        await this.saveOutputsToDisk(session);

        this.logger.info(`Checkpoint saved for session ${session.id}`);
        this.emit('checkpoint:saved', {
            sessionId: session.id,
            checkpoint
        });
    }

    /**
     * Save outputs to disk
     */
    async saveOutputsToDisk(session) {
        const outputDir = path.join(
            process.cwd(),
            'autonomous-outputs',
            session.id
        );

        try {
            await fs.mkdir(outputDir, { recursive: true });
            
            // Save session data
            const sessionData = {
                ...session,
                outputs: session.outputs.slice(-100) // Keep last 100 outputs in memory
            };
            
            await fs.writeFile(
                path.join(outputDir, 'session.json'),
                JSON.stringify(sessionData, null, 2)
            );

            // Save all outputs
            await fs.writeFile(
                path.join(outputDir, 'outputs.json'),
                JSON.stringify(session.outputs, null, 2)
            );

            this.logger.info(`Outputs saved to ${outputDir}`);
        } catch (error) {
            this.logger.error('Error saving outputs:', error);
        }
    }

    /**
     * Track API usage
     */
    trackApiUsage(results) {
        this.apiUsage.requests += results.length;
        
        // Estimate tokens (rough approximation)
        results.forEach(result => {
            const content = JSON.stringify(result.contribution || '');
            this.apiUsage.tokensUsed += Math.ceil(content.length / 4);
        });
    }

    /**
     * Check if API limit reached
     */
    isApiLimitReached() {
        const hourElapsed = Date.now() - this.apiUsage.lastReset.getTime();
        
        if (hourElapsed >= 60 * 60 * 1000) {
            this.resetHourlyLimits();
            return false;
        }

        return (
            this.apiUsage.requests >= this.API_LIMITS.maxRequestsPerHour ||
            this.apiUsage.tokensUsed >= this.API_LIMITS.maxTokensPerHour
        );
    }

    /**
     * Reset hourly API limits
     */
    resetHourlyLimits() {
        if (Date.now() - this.apiUsage.lastReset.getTime() >= 60 * 60 * 1000) {
            this.apiUsage.requests = 0;
            this.apiUsage.tokensUsed = 0;
            this.apiUsage.lastReset = new Date();
        }
    }

    /**
     * Update session metrics
     */
    updateSessionMetrics(session, result) {
        if (result.metrics) {
            if (result.metrics.wordsWritten) {
                session.metrics.wordsWritten += result.metrics.wordsWritten;
            }
            if (result.metrics.ideasGenerated) {
                session.metrics.ideasGenerated += result.metrics.ideasGenerated;
            }
            if (result.metrics.outputsReviewed) {
                session.metrics.revisionsCompleted += result.metrics.outputsReviewed;
            }
        }
    }

    /**
     * Generate session report
     */
    async generateSessionReport(session) {
        const duration = session.endTime - session.startTime;
        const hours = Math.floor(duration / (60 * 60 * 1000));
        const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));

        const activitySummary = {};
        session.activities.forEach(activity => {
            if (!activitySummary[activity.type]) {
                activitySummary[activity.type] = {
                    count: 0,
                    totalDuration: 0
                };
            }
            activitySummary[activity.type].count++;
            if (activity.endTime) {
                activitySummary[activity.type].totalDuration += 
                    activity.endTime - activity.startTime;
            }
        });

        return {
            sessionId: session.id,
            duration: { hours, minutes },
            metrics: session.metrics,
            activitySummary,
            outputCount: session.outputs.length,
            checkpointCount: session.checkpoints.length,
            apiUsage: this.apiUsage
        };
    }

    /**
     * Get current session status
     */
    getSessionStatus() {
        if (!this.activeSession) {
            return null;
        }

        const currentActivity = this.activeSession.activities[this.activeSession.activities.length - 1];
        
        return {
            sessionId: this.activeSession.id,
            status: this.activeSession.status,
            elapsed: Date.now() - this.activeSession.startTime.getTime(),
            currentActivity: currentActivity ? {
                type: currentActivity.type,
                startTime: currentActivity.startTime,
                duration: currentActivity.endTime ? 
                    currentActivity.endTime - currentActivity.startTime :
                    Date.now() - currentActivity.startTime
            } : null,
            metrics: this.activeSession.metrics,
            apiUsage: this.apiUsage
        };
    }

    /**
     * Get session history
     */
    getSessionHistory() {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            metrics: session.metrics
        }));
    }
}

// Export singleton instance
module.exports = new AutonomousService();