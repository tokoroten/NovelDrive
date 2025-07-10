const { EventEmitter } = require('events');
const { getLogger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const personalityService = require('../services/personality-service');

/**
 * Base class for all AI agents in the multi-agent system
 */
class BaseAgent extends EventEmitter {
    constructor(agentId, agentType, config = {}) {
        super();
        
        this.id = agentId;
        this.type = agentType;
        this.name = config.name || `${agentType}-${agentId}`;
        this.status = 'idle'; // idle, thinking, responding, waiting
        this.config = config;
        this.logger = getLogger();
        
        // Message history
        this.messageHistory = [];
        this.maxHistorySize = config.maxHistorySize || 100;
        
        // Agent capabilities
        this.capabilities = config.capabilities || [];
        
        // Personality
        this.personality = null;
        this.personalityTraits = null;
        
        // Initialize agent
        this.initialize();
    }

    /**
     * Initialize the agent (to be overridden by subclasses)
     */
    initialize() {
        this.logger.info(`Initializing agent: ${this.name} (${this.type})`);
        
        // Load default personality for this agent type
        this.loadDefaultPersonality();
    }
    
    /**
     * Load default personality for agent type
     */
    loadDefaultPersonality() {
        const personality = personalityService.getPersonalityForAgent(this.type);
        if (personality) {
            this.setPersonality(personality);
            this.logger.info(`Loaded personality: ${personality.name} for ${this.name}`);
        } else {
            this.logger.warn(`No default personality found for agent type: ${this.type}`);
        }
    }
    
    /**
     * Set personality for this agent
     * @param {Object} personality
     */
    setPersonality(personality) {
        if (!personality) {
            throw new Error('Personality is required');
        }
        
        if (personality.role !== this.type) {
            throw new Error(`Personality role ${personality.role} does not match agent type ${this.type}`);
        }
        
        this.personality = personality;
        this.personalityTraits = personality.traits;
        this.name = personality.name || this.name;
        
        // Update capabilities based on personality
        if (personality.traits && personality.traits.expertise) {
            this.updateCapabilitiesFromPersonality(personality.traits.expertise);
        }
        
        this.emit('personality:changed', {
            agentId: this.id,
            personality: personality
        });
    }
    
    /**
     * Update capabilities based on personality expertise
     * @param {Object} expertise
     */
    updateCapabilitiesFromPersonality(expertise) {
        // Add genre-specific capabilities
        if (expertise.genre) {
            expertise.genre.forEach(genre => {
                const capability = `${genre.toLowerCase()}_expertise`;
                if (!this.capabilities.includes(capability)) {
                    this.capabilities.push(capability);
                }
            });
        }
    }
    
    /**
     * Get personality-adjusted parameters
     * @returns {Object}
     */
    getPersonalityParameters() {
        if (!this.personalityTraits) {
            return {
                temperature: 0.7,
                creativity: 0.5,
                formality: 0.5
            };
        }
        
        const traits = this.personalityTraits;
        return {
            temperature: 0.5 + (traits.creativity.riskTaking * 0.5),
            creativity: traits.creativity.abstractness,
            formality: traits.communication.formality,
            assertiveness: traits.communication.assertiveness,
            empathy: traits.communication.empathy
        };
    }
    
    /**
     * Get personality system prompt
     * @returns {string}
     */
    getSystemPrompt() {
        return this.personality ? this.personality.systemPrompt : '';
    }

    /**
     * Process incoming message
     * @param {Object} message - The message to process
     * @returns {Promise<Object>} Response message
     */
    async processMessage(message) {
        this.logger.debug(`${this.name} received message:`, message);
        
        // Update status
        this.setStatus('thinking');
        
        try {
            // Validate message
            this.validateMessage(message);
            
            // Add to history
            this.addToHistory(message);
            
            // Process based on message type
            let response;
            switch (message.type) {
                case 'query':
                    response = await this.handleQuery(message);
                    break;
                case 'task':
                    response = await this.handleTask(message);
                    break;
                case 'feedback':
                    response = await this.handleFeedback(message);
                    break;
                case 'discussion':
                    response = await this.handleDiscussion(message);
                    break;
                case 'plot_creation':
                    response = await this.handlePlotCreation(message);
                    break;
                default:
                    response = await this.handleGenericMessage(message);
            }
            
            // Create response message
            const responseMessage = this.createMessage(
                message.type + '_response',
                response,
                message.sender
            );
            
            // Add response to history
            this.addToHistory(responseMessage);
            
            // Update status
            this.setStatus('idle');
            
            return responseMessage;
            
        } catch (error) {
            this.logger.error(`${this.name} error processing message:`, error);
            this.setStatus('error');
            
            return this.createMessage(
                'error',
                { error: error.message },
                message.sender
            );
        }
    }

    /**
     * Handle query messages (to be overridden by subclasses)
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleQuery(message) {
        throw new Error('handleQuery must be implemented by subclass');
    }

    /**
     * Handle task messages (to be overridden by subclasses)
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleTask(message) {
        throw new Error('handleTask must be implemented by subclass');
    }

    /**
     * Handle feedback messages (to be overridden by subclasses)
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleFeedback(message) {
        throw new Error('handleFeedback must be implemented by subclass');
    }

    /**
     * Handle discussion messages (to be overridden by subclasses)
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleDiscussion(message) {
        throw new Error('handleDiscussion must be implemented by subclass');
    }

    /**
     * Handle plot creation messages (to be overridden by subclasses)
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handlePlotCreation(message) {
        throw new Error('handlePlotCreation must be implemented by subclass');
    }

    /**
     * Handle generic messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleGenericMessage(message) {
        return {
            content: `${this.name} received your message but doesn't know how to handle message type: ${message.type}`,
            status: 'unhandled'
        };
    }

    /**
     * Create a message object
     * @param {string} type - Message type
     * @param {Object} content - Message content
     * @param {string} recipient - Recipient agent ID
     * @returns {Object} Message object
     */
    createMessage(type, content, recipient = null) {
        return {
            id: uuidv4(),
            sender: this.id,
            recipient: recipient,
            type: type,
            content: content,
            timestamp: new Date().toISOString(),
            metadata: {
                senderName: this.name,
                senderType: this.type
            }
        };
    }

    /**
     * Send message to another agent or broadcast
     * @param {string} type - Message type
     * @param {Object} content - Message content
     * @param {string} recipient - Recipient agent ID (null for broadcast)
     */
    sendMessage(type, content, recipient = null) {
        const message = this.createMessage(type, content, recipient);
        
        if (recipient) {
            this.emit('message:send', message);
        } else {
            this.emit('message:broadcast', message);
        }
        
        this.logger.debug(`${this.name} sent message:`, message);
    }

    /**
     * Validate incoming message
     * @param {Object} message
     * @throws {Error} If message is invalid
     */
    validateMessage(message) {
        if (!message) {
            throw new Error('Message is required');
        }
        
        if (!message.id) {
            throw new Error('Message ID is required');
        }
        
        if (!message.type) {
            throw new Error('Message type is required');
        }
        
        if (!message.sender) {
            throw new Error('Message sender is required');
        }
        
        if (!message.content) {
            throw new Error('Message content is required');
        }
    }

    /**
     * Add message to history
     * @param {Object} message
     */
    addToHistory(message) {
        this.messageHistory.push(message);
        
        // Trim history if it exceeds max size
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get message history
     * @param {number} limit - Number of messages to retrieve
     * @returns {Array} Message history
     */
    getHistory(limit = 10) {
        return this.messageHistory.slice(-limit);
    }

    /**
     * Clear message history
     */
    clearHistory() {
        this.messageHistory = [];
    }

    /**
     * Set agent status
     * @param {string} status
     */
    setStatus(status) {
        const oldStatus = this.status;
        this.status = status;
        this.emit('status:change', { oldStatus, newStatus: status });
        this.logger.debug(`${this.name} status changed: ${oldStatus} -> ${status}`);
    }

    /**
     * Get agent status
     * @returns {string}
     */
    getStatus() {
        return this.status;
    }

    /**
     * Check if agent has capability
     * @param {string} capability
     * @returns {boolean}
     */
    hasCapability(capability) {
        return this.capabilities.includes(capability);
    }

    /**
     * Get agent info
     * @returns {Object}
     */
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            status: this.status,
            capabilities: this.capabilities,
            historySize: this.messageHistory.length,
            personality: this.personality ? {
                id: this.personality.id,
                name: this.personality.name,
                description: this.personality.description
            } : null
        };
    }

    /**
     * Shutdown agent
     */
    async shutdown() {
        this.logger.info(`Shutting down agent: ${this.name}`);
        this.setStatus('shutdown');
        this.removeAllListeners();
        this.clearHistory();
    }
}

// Message types enum
BaseAgent.MessageTypes = {
    QUERY: 'query',
    TASK: 'task',
    FEEDBACK: 'feedback',
    DISCUSSION: 'discussion',
    RESPONSE: 'response',
    ERROR: 'error',
    STATUS: 'status',
    BROADCAST: 'broadcast'
};

// Agent types enum
BaseAgent.AgentTypes = {
    DEPUTY_EDITOR: 'deputy_editor',
    WRITER: 'writer',
    EDITOR: 'editor',
    PROOFREADER: 'proofreader',
    COORDINATOR: 'coordinator'
};

// Agent status enum
BaseAgent.AgentStatus = {
    IDLE: 'idle',
    THINKING: 'thinking',
    RESPONDING: 'responding',
    WAITING: 'waiting',
    ERROR: 'error',
    SHUTDOWN: 'shutdown'
};

module.exports = BaseAgent;