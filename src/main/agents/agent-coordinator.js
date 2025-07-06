const { EventEmitter } = require('events');
const { getLogger } = require('../utils/logger');
const openAIService = require('../services/openai-service');
const personalityService = require('../services/personality-service');

/**
 * Agent Coordinator - Manages communication between agents
 */
class AgentCoordinator extends EventEmitter {
    constructor() {
        super();
        
        this.logger = getLogger();
        this.agents = new Map();
        this.messageQueue = [];
        this.isProcessing = false;
        this.sessions = new Map();
        
        // Message routing
        this.routingRules = new Map();
        
        // Initialize
        this.initialize();
    }

    /**
     * Initialize the coordinator
     */
    initialize() {
        this.logger.info('Initializing Agent Coordinator');
        
        // Start message processing loop
        this.startMessageProcessing();
    }

    /**
     * Register an agent
     * @param {BaseAgent} agent
     */
    registerAgent(agent) {
        if (!agent || !agent.id) {
            throw new Error('Invalid agent');
        }
        
        this.agents.set(agent.id, agent);
        
        // Setup event listeners
        agent.on('message:send', (message) => this.handleDirectMessage(message));
        agent.on('message:broadcast', (message) => this.handleBroadcast(message));
        agent.on('status:change', (status) => this.handleStatusChange(agent.id, status));
        
        this.logger.info(`Registered agent: ${agent.name} (${agent.id})`);
        this.emit('agent:registered', agent.getInfo());
    }

    /**
     * Unregister an agent
     * @param {string} agentId
     */
    unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.removeAllListeners();
            this.agents.delete(agentId);
            this.logger.info(`Unregistered agent: ${agent.name} (${agentId})`);
            this.emit('agent:unregistered', agentId);
        }
    }

    /**
     * Get agent by ID
     * @param {string} agentId
     * @returns {BaseAgent|null}
     */
    getAgent(agentId) {
        return this.agents.get(agentId) || null;
    }

    /**
     * Get all agents
     * @returns {Array}
     */
    getAllAgents() {
        return Array.from(this.agents.values());
    }

    /**
     * Get agents by type
     * @param {string} agentType
     * @returns {Array}
     */
    getAgentsByType(agentType) {
        return Array.from(this.agents.values()).filter(agent => agent.type === agentType);
    }

    /**
     * Handle direct message between agents
     * @param {Object} message
     */
    async handleDirectMessage(message) {
        this.logger.debug('Handling direct message:', message);
        
        // Add to queue
        this.messageQueue.push({
            type: 'direct',
            message: message,
            timestamp: new Date()
        });
        
        // Process queue
        await this.processMessageQueue();
    }

    /**
     * Handle broadcast message
     * @param {Object} message
     */
    async handleBroadcast(message) {
        this.logger.debug('Handling broadcast message:', message);
        
        // Add to queue
        this.messageQueue.push({
            type: 'broadcast',
            message: message,
            timestamp: new Date()
        });
        
        // Process queue
        await this.processMessageQueue();
    }

    /**
     * Process message queue
     */
    async processMessageQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            while (this.messageQueue.length > 0) {
                const item = this.messageQueue.shift();
                
                if (item.type === 'direct') {
                    await this.deliverDirectMessage(item.message);
                } else if (item.type === 'broadcast') {
                    await this.deliverBroadcast(item.message);
                }
                
                // Small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        } catch (error) {
            this.logger.error('Error processing message queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Deliver direct message to recipient
     * @param {Object} message
     */
    async deliverDirectMessage(message) {
        const recipient = this.agents.get(message.recipient);
        
        if (!recipient) {
            this.logger.warn(`Recipient not found: ${message.recipient}`);
            
            // Send error back to sender
            const sender = this.agents.get(message.sender);
            if (sender) {
                const errorMessage = {
                    id: `error-${Date.now()}`,
                    sender: 'coordinator',
                    recipient: message.sender,
                    type: 'error',
                    content: {
                        error: `Recipient agent not found: ${message.recipient}`,
                        originalMessage: message
                    },
                    timestamp: new Date().toISOString()
                };
                
                await sender.processMessage(errorMessage);
            }
            
            return;
        }
        
        // Check if recipient is available
        if (recipient.getStatus() === 'shutdown') {
            this.logger.warn(`Recipient is shutdown: ${message.recipient}`);
            return;
        }
        
        // Deliver message
        try {
            const response = await recipient.processMessage(message);
            
            // If there's a response, deliver it back
            if (response && response.recipient) {
                await this.deliverDirectMessage(response);
            }
            
            // Emit event
            this.emit('message:delivered', {
                message: message,
                response: response
            });
            
        } catch (error) {
            this.logger.error(`Error delivering message to ${recipient.name}:`, error);
            
            // Send error back to sender
            const sender = this.agents.get(message.sender);
            if (sender) {
                const errorMessage = {
                    id: `error-${Date.now()}`,
                    sender: 'coordinator',
                    recipient: message.sender,
                    type: 'error',
                    content: {
                        error: `Failed to deliver message: ${error.message}`,
                        originalMessage: message
                    },
                    timestamp: new Date().toISOString()
                };
                
                await sender.processMessage(errorMessage);
            }
        }
    }

    /**
     * Deliver broadcast message to all agents except sender
     * @param {Object} message
     */
    async deliverBroadcast(message) {
        const promises = [];
        
        for (const [agentId, agent] of this.agents) {
            // Skip sender and shutdown agents
            if (agentId === message.sender || agent.getStatus() === 'shutdown') {
                continue;
            }
            
            // Deliver message asynchronously
            promises.push(
                agent.processMessage(message)
                    .catch(error => {
                        this.logger.error(`Error broadcasting to ${agent.name}:`, error);
                    })
            );
        }
        
        // Wait for all deliveries
        await Promise.all(promises);
        
        // Emit event
        this.emit('broadcast:completed', {
            message: message,
            recipientCount: promises.length
        });
    }

    /**
     * Handle agent status change
     * @param {string} agentId
     * @param {Object} status
     */
    handleStatusChange(agentId, status) {
        this.emit('agent:status', {
            agentId: agentId,
            ...status
        });
    }

    /**
     * Create a discussion session
     * @param {string} sessionId
     * @param {Array} participantIds
     * @param {Object} topic
     * @returns {Object} Session info
     */
    createSession(sessionId, participantIds, topic) {
        const session = {
            id: sessionId,
            participants: participantIds,
            topic: topic,
            messages: [],
            status: 'active',
            createdAt: new Date(),
            metadata: {}
        };
        
        this.sessions.set(sessionId, session);
        
        // Notify participants
        const notification = {
            id: `session-${Date.now()}`,
            sender: 'coordinator',
            type: 'session:created',
            content: {
                sessionId: sessionId,
                topic: topic,
                participants: participantIds
            },
            timestamp: new Date().toISOString()
        };
        
        participantIds.forEach(agentId => {
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.processMessage({ ...notification, recipient: agentId });
            }
        });
        
        this.logger.info(`Created session: ${sessionId}`);
        return session;
    }

    /**
     * End a discussion session
     * @param {string} sessionId
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        session.status = 'ended';
        session.endedAt = new Date();
        
        // Notify participants
        const notification = {
            id: `session-${Date.now()}`,
            sender: 'coordinator',
            type: 'session:ended',
            content: {
                sessionId: sessionId,
                summary: this.generateSessionSummary(session)
            },
            timestamp: new Date().toISOString()
        };
        
        session.participants.forEach(agentId => {
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.processMessage({ ...notification, recipient: agentId });
            }
        });
        
        this.logger.info(`Ended session: ${sessionId}`);
    }

    /**
     * Generate session summary
     * @param {Object} session
     * @returns {Object}
     */
    generateSessionSummary(session) {
        return {
            totalMessages: session.messages.length,
            duration: session.endedAt - session.createdAt,
            participants: session.participants,
            topic: session.topic
        };
    }

    /**
     * Get session by ID
     * @param {string} sessionId
     * @returns {Object|null}
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get all active sessions
     * @returns {Array}
     */
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }

    /**
     * Start message processing loop
     */
    startMessageProcessing() {
        setInterval(() => {
            if (this.messageQueue.length > 0) {
                this.processMessageQueue();
            }
        }, 100);
    }

    /**
     * Get coordinator statistics
     * @returns {Object}
     */
    getStatistics() {
        return {
            totalAgents: this.agents.size,
            activeAgents: Array.from(this.agents.values()).filter(a => a.getStatus() !== 'shutdown').length,
            queuedMessages: this.messageQueue.length,
            activeSessions: this.getActiveSessions().length,
            totalSessions: this.sessions.size
        };
    }
    
    /**
     * Generate autonomous topic based on project state
     * @param {Object} projectContext
     * @param {string} activityType
     * @returns {Object} Topic configuration
     */
    async generateAutonomousTopic(projectContext, activityType) {
        const { projectId, recentOutputs, currentChapter, plotPoints } = projectContext;
        
        switch (activityType) {
            case 'writing':
                return this.generateWritingTopic(projectContext);
            case 'brainstorming':
                return this.generateBrainstormingTopic(projectContext);
            case 'reviewing':
                return this.generateReviewingTopic(projectContext);
            case 'plotting':
                return this.generatePlottingTopic(projectContext);
            case 'character':
                return this.generateCharacterTopic(projectContext);
            case 'worldbuilding':
                return this.generateWorldbuildingTopic(projectContext);
            default:
                throw new Error(`Unknown activity type: ${activityType}`);
        }
    }
    
    /**
     * Generate writing topic
     */
    generateWritingTopic(context) {
        const topics = [
            {
                type: 'scene-continuation',
                prompt: 'Continue the current scene with focus on character development',
                priority: context.currentChapter ? 'high' : 'medium'
            },
            {
                type: 'dialogue-enrichment',
                prompt: 'Add meaningful dialogue that reveals character and advances plot',
                priority: 'medium'
            },
            {
                type: 'description-enhancement',
                prompt: 'Enhance descriptions to create atmosphere and mood',
                priority: 'low'
            },
            {
                type: 'action-sequence',
                prompt: 'Write dynamic action or tension-building sequences',
                priority: 'medium'
            }
        ];
        
        // Prioritize based on recent outputs
        if (!context.recentOutputs || context.recentOutputs.length === 0) {
            return topics[0]; // Start with scene continuation
        }
        
        // Analyze recent outputs to determine what's needed
        const recentTypes = context.recentOutputs.map(o => o.metadata?.type).filter(Boolean);
        
        // Balance output types
        if (!recentTypes.includes('dialogue-enrichment')) {
            return topics[1];
        } else if (!recentTypes.includes('description-enhancement')) {
            return topics[2];
        } else {
            return topics[Math.floor(Math.random() * topics.length)];
        }
    }
    
    /**
     * Generate brainstorming topic
     */
    generateBrainstormingTopic(context) {
        const areas = [
            'plot-twist',
            'character-conflict',
            'thematic-element',
            'subplot-development',
            'world-expansion'
        ];
        
        const area = areas[Math.floor(Math.random() * areas.length)];
        
        return {
            type: 'brainstorming',
            area: area,
            prompt: `Generate creative ideas for ${area.replace('-', ' ')}`,
            context: {
                projectId: context.projectId,
                existingElements: context.plotPoints || []
            }
        };
    }
    
    /**
     * Generate reviewing topic
     */
    generateReviewingTopic(context) {
        if (!context.recentOutputs || context.recentOutputs.length === 0) {
            return {
                type: 'general-review',
                prompt: 'Review project structure and suggest improvements',
                priority: 'low'
            };
        }
        
        // Focus on recent writing outputs
        const writingOutputs = context.recentOutputs.filter(o => o.type === 'writing');
        
        if (writingOutputs.length > 0) {
            return {
                type: 'content-review',
                prompt: 'Review recent writing for consistency, pacing, and quality',
                content: writingOutputs[0],
                priority: 'high'
            };
        }
        
        return {
            type: 'structural-review',
            prompt: 'Analyze story structure and suggest improvements',
            priority: 'medium'
        };
    }
    
    /**
     * Generate plotting topic
     */
    generatePlottingTopic(context) {
        const aspects = [
            'rising-action',
            'climax-development',
            'resolution-planning',
            'subplot-integration',
            'pacing-adjustment'
        ];
        
        return {
            type: 'plot-development',
            aspect: aspects[Math.floor(Math.random() * aspects.length)],
            prompt: 'Develop plot structure and key story moments',
            existingPlot: context.plotPoints || []
        };
    }
    
    /**
     * Generate character topic
     */
    generateCharacterTopic(context) {
        const focuses = [
            'backstory-development',
            'motivation-clarification',
            'relationship-dynamics',
            'character-arc',
            'personality-traits'
        ];
        
        return {
            type: 'character-development',
            focus: focuses[Math.floor(Math.random() * focuses.length)],
            prompt: 'Develop deep, compelling characters',
            existingCharacters: context.characters || []
        };
    }
    
    /**
     * Generate worldbuilding topic
     */
    generateWorldbuildingTopic(context) {
        const elements = [
            'geography-mapping',
            'culture-creation',
            'history-building',
            'magic-system',
            'technology-level',
            'social-structure'
        ];
        
        return {
            type: 'world-development',
            element: elements[Math.floor(Math.random() * elements.length)],
            prompt: 'Create rich, detailed world elements',
            existingWorld: context.worldElements || []
        };
    }

    /**
     * Start a discussion session
     * @param {string} sessionId
     * @param {Object} config
     */
    async startSession(sessionId, config) {
        const { type, participants } = config;
        
        // Create session
        const session = this.createSession(sessionId, participants, {
            type: type,
            startTime: new Date()
        });
        
        this.logger.info(`Starting session ${sessionId} with participants: ${participants.join(', ')}`);
        
        return session;
    }
    
    /**
     * Handle discussion topic
     * @param {Object} data
     */
    async discussTopic(data) {
        const { sessionId, topic, content, context } = data;
        const session = this.getSession(sessionId);
        
        if (!session || session.status !== 'active') {
            throw new Error('Invalid or inactive session');
        }
        
        const results = [];
        
        // Get each agent's perspective using OpenAI if available
        for (const agentId of session.participants) {
            const agent = this.agents.get(agentId);
            if (!agent) continue;
            
            try {
                // Create discussion message
                const message = {
                    id: `disc-${Date.now()}-${Math.random()}`,
                    sender: 'user',
                    recipient: agentId,
                    type: 'discussion',
                    content: {
                        topic: topic,
                        content: content,
                        context: context,
                        sessionId: sessionId
                    },
                    timestamp: new Date().toISOString()
                };
                
                // Send to agent and get response
                const response = await agent.processMessage(message);
                
                if (response) {
                    results.push({
                        agentId: agentId,
                        agentType: agent.type,
                        contribution: response.content
                    });
                    
                    // Emit agent message event
                    this.emit('agent:message', {
                        sessionId: sessionId,
                        agentId: agentId,
                        message: response.content.suggestion || response.content.viewpoint || response.content
                    });
                }
                
            } catch (error) {
                this.logger.error(`Error getting response from ${agent.name}:`, error);
            }
        }
        
        // Store in session history
        session.messages.push({
            topic: topic,
            content: content,
            responses: results,
            timestamp: new Date()
        });
        
        return results;
    }
    
    /**
     * Get registered agents info
     */
    getRegisteredAgents() {
        return Array.from(this.agents.values()).map(agent => ({
            id: agent.id,
            name: agent.name,
            type: agent.type,
            status: agent.getStatus(),
            config: agent.config
        }));
    }

    /**
     * Shutdown coordinator
     */
    async shutdown() {
        this.logger.info('Shutting down Agent Coordinator');
        
        // End all sessions
        this.getActiveSessions().forEach(session => {
            this.endSession(session.id);
        });
        
        // Shutdown all agents
        const shutdownPromises = Array.from(this.agents.values()).map(agent => 
            agent.shutdown().catch(error => {
                this.logger.error(`Error shutting down ${agent.name}:`, error);
            })
        );
        
        await Promise.all(shutdownPromises);
        
        // Clear data
        this.agents.clear();
        this.sessions.clear();
        this.messageQueue = [];
        
        // Remove all listeners
        this.removeAllListeners();
        
        this.logger.info('Agent Coordinator shutdown complete');
    }
}

// Export singleton instance
const coordinator = new AgentCoordinator();

module.exports = coordinator;