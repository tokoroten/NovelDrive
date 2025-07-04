const { EventEmitter } = require('events');
const { getLogger } = require('../utils/logger');

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