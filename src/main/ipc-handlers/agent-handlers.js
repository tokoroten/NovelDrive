const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');
const agentCoordinator = require('../agents/agent-coordinator');
const DeputyEditorAgent = require('../agents/deputy-editor-agent');
const WriterAgent = require('../agents/writer-agent');
const EditorAgent = require('../agents/editor-agent');
const ProofreaderAgent = require('../agents/proofreader-agent');
const { getProjectRepository } = require('../repositories');
const { v4: uuidv4 } = require('uuid');

const logger = getLogger('agent-handlers');

// Global session tracking
const activeSessions = new Map();

/**
 * Initialize agent system
 */
function initializeAgentSystem() {
    if (!agentCoordinator.agents.size) {
        
        // Create and register agents
        const agents = [
            new DeputyEditorAgent('deputy-editor-1'),
            new WriterAgent('writer-1', { serendipityEnabled: true }),
            new EditorAgent('editor-1'),
            new ProofreaderAgent('proofreader-1')
        ];
        
        agents.forEach(agent => {
            agent.initialize();
            agentCoordinator.registerAgent(agent);
        });
        
        logger.info('Agent system initialized with all agents');
    }
}

/**
 * Register agent-related IPC handlers
 */
function registerAgentHandlers(mainWindow) {
    // Initialize agent system
    initializeAgentSystem();
    
    // Start agent session
    ipcMain.handle('agents:startSession', async (event, data) => {
        try {
            const { type, participants, projectId, context } = data;
            
            logger.info(`Starting agent session: ${type} with ${participants.join(', ')}`);
            
            // Create session
            const sessionId = uuidv4();
            const sessionData = {
                id: sessionId,
                type,
                participants,
                projectId,
                context,
                startTime: new Date(),
                messages: []
            };
            
            // Store session
            activeSessions.set(sessionId, sessionData);
            
            // Start session in coordinator
            await agentCoordinator.startSession(sessionId, {
                type,
                participants: participants.map(p => {
                    switch(p) {
                        case 'deputy_editor': return 'deputy-editor-1';
                        case 'writer': return 'writer-1';
                        case 'editor': return 'editor-1';
                        case 'proofreader': return 'proofreader-1';
                        default: return null;
                    }
                }).filter(Boolean)
            });
            
            // Set up event forwarding
            setupSessionEventForwarding(sessionId, mainWindow);
            
            return sessionData;
        } catch (error) {
            logger.error('Failed to start agent session:', error);
            throw error;
        }
    });
    
    // Send message to agents
    ipcMain.handle('agents:sendMessage', async (event, data) => {
        try {
            const { sessionId, message, role } = data;
            
            const session = activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            
            // Add message to session history
            session.messages.push({
                role,
                content: message,
                timestamp: new Date()
            });
            
            // Send to agents for processing
            const results = await agentCoordinator.discussTopic({
                sessionId,
                topic: determineTopicFromMessage(message, session.type),
                content: message,
                context: session.context
            });
            
            // Process agent responses
            for (const result of results) {
                mainWindow.webContents.send('agents:message', {
                    sessionId,
                    agentType: getAgentTypeFromId(result.agentId),
                    message: result.contribution.suggestion || result.contribution.viewpoint,
                    timestamp: new Date()
                });
                
                // Add to session history
                session.messages.push({
                    role: result.agentId,
                    content: result.contribution,
                    timestamp: new Date()
                });
            }
            
            return { success: true };
        } catch (error) {
            logger.error('Failed to send message to agents:', error);
            throw error;
        }
    });
    
    // End agent session
    ipcMain.handle('agents:endSession', async (event, data) => {
        try {
            const { sessionId } = data;
            
            const session = activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            
            // End session in coordinator
            await agentCoordinator.endSession(sessionId);
            
            // Save session to database if needed
            await saveSessionToDatabase(session);
            
            // Clean up
            activeSessions.delete(sessionId);
            
            // Notify frontend
            mainWindow.webContents.send('agents:sessionEnded', { sessionId });
            
            return { success: true };
        } catch (error) {
            logger.error('Failed to end agent session:', error);
            throw error;
        }
    });
    
    // Get agent status
    ipcMain.handle('agents:getStatus', async (event, data) => {
        try {
            const agents = agentCoordinator.getRegisteredAgents();
            const status = {};
            
            agents.forEach(agent => {
                status[getAgentTypeFromId(agent.id)] = {
                    status: agent.status,
                    capabilities: agent.config.capabilities
                };
            });
            
            return status;
        } catch (error) {
            logger.error('Failed to get agent status:', error);
            throw error;
        }
    });
    
    // Save agent output
    ipcMain.handle('agents:saveOutput', async (event, data) => {
        try {
            const { projectId, output } = data;
            
            const projectRepo = getProjectRepository();
            const project = await projectRepo.get(projectId);
            
            if (!project) {
                throw new Error('Project not found');
            }
            
            // Save output to project
            const updatedProject = {
                ...project,
                agentOutputs: [
                    ...(project.agentOutputs || []),
                    {
                        ...output,
                        savedAt: new Date().toISOString()
                    }
                ]
            };
            
            await projectRepo.update(projectId, updatedProject);
            
            logger.info(`Saved agent output to project ${projectId}`);
            return { success: true };
        } catch (error) {
            logger.error('Failed to save agent output:', error);
            throw error;
        }
    });
    
    logger.info('Agent handlers registered');
}

/**
 * Setup event forwarding for a session
 */
function setupSessionEventForwarding(sessionId, mainWindow) {
    const coordinator = agentCoordinator;
    
    // Remove existing listeners to prevent duplicates
    coordinator.removeAllListeners('agent:status');
    coordinator.removeAllListeners('agent:message');
    coordinator.removeAllListeners('session:output');
    
    // Forward agent status updates
    coordinator.on('agent:status', (data) => {
        mainWindow.webContents.send('agents:statusUpdate', {
            agentType: getAgentTypeFromId(data.agentId),
            status: data.status
        });
    });
    
    // Forward agent messages
    coordinator.on('agent:message', (data) => {
        if (data.sessionId === sessionId) {
            mainWindow.webContents.send('agents:message', {
                sessionId: data.sessionId,
                agentType: getAgentTypeFromId(data.agentId),
                message: data.message,
                timestamp: new Date()
            });
        }
    });
    
    // Forward outputs
    coordinator.on('session:output', (data) => {
        if (data.sessionId === sessionId) {
            mainWindow.webContents.send('agents:output', {
                sessionId,
                type: data.type,
                title: data.title,
                preview: data.preview,
                content: data.content
            });
        }
    });
}

/**
 * Determine topic from message and session type
 */
function determineTopicFromMessage(message, sessionType) {
    const topics = {
        plot_development: 'plot_structure',
        chapter_writing: 'chapter_content',
        character_development: 'character_design',
        review_discussion: 'manuscript_review',
        brainstorming: 'creative_ideas'
    };
    
    return topics[sessionType] || 'general_discussion';
}

/**
 * Get agent type from agent ID
 */
function getAgentTypeFromId(agentId) {
    const mapping = {
        'deputy-editor-1': 'deputy_editor',
        'writer-1': 'writer',
        'editor-1': 'editor',
        'proofreader-1': 'proofreader'
    };
    
    return mapping[agentId] || 'unknown';
}

/**
 * Save session to database
 */
async function saveSessionToDatabase(session) {
    try {
        const projectRepo = getProjectRepository();
        const project = await projectRepo.get(session.projectId);
        
        if (!project) {
            logger.warn(`Project ${session.projectId} not found, skipping session save`);
            return;
        }
        
        // Add session to project history
        const sessionSummary = {
            id: session.id,
            type: session.type,
            participants: session.participants,
            startTime: session.startTime,
            endTime: new Date(),
            messageCount: session.messages.length,
            summary: generateSessionSummary(session)
        };
        
        const updatedProject = {
            ...project,
            agentSessions: [
                ...(project.agentSessions || []),
                sessionSummary
            ]
        };
        
        await projectRepo.update(session.projectId, updatedProject);
        
        logger.info(`Saved session ${session.id} to project ${session.projectId}`);
    } catch (error) {
        logger.error('Failed to save session to database:', error);
        // Don't throw - this is not critical
    }
}

/**
 * Generate session summary
 */
function generateSessionSummary(session) {
    const messageCount = session.messages.length;
    const agentMessages = session.messages.filter(m => m.role !== 'user').length;
    
    return {
        totalMessages: messageCount,
        userMessages: messageCount - agentMessages,
        agentMessages: agentMessages,
        topics: extractTopicsFromMessages(session.messages),
        outputs: session.outputs || []
    };
}

/**
 * Extract topics from messages
 */
function extractTopicsFromMessages(messages) {
    // Simple topic extraction - in real implementation would use NLP
    const topics = new Set();
    
    messages.forEach(msg => {
        if (typeof msg.content === 'string') {
            // Extract keywords
            if (msg.content.includes('プロット')) topics.add('plot');
            if (msg.content.includes('キャラクター')) topics.add('character');
            if (msg.content.includes('設定')) topics.add('setting');
            if (msg.content.includes('テーマ')) topics.add('theme');
        }
    });
    
    return Array.from(topics);
}

module.exports = {
    registerAgentHandlers,
    initializeAgentSystem
};