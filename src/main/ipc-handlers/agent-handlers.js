const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');
const agentCoordinator = require('../agents/agent-coordinator');
const DeputyEditorAgent = require('../agents/deputy-editor-agent');
const WriterAgent = require('../agents/writer-agent');
const EditorAgent = require('../agents/editor-agent');
const ProofreaderAgent = require('../agents/proofreader-agent');
const workflowCoordinator = require('../services/workflow-coordinator-service');
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
function registerAgentHandlers(mainWindow, db) {
    // Initialize agent system
    initializeAgentSystem();
    
    // Initialize workflow coordinator with database
    if (db) {
        workflowCoordinator.initialize(db);
    }
    
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
            
            // Map participants to agent IDs
            const mappedParticipants = [];
            for (const p of participants) {
                if (p.startsWith('custom_')) {
                    // Handle custom agents
                    const customAgentId = p.replace('custom_', '');
                    const customAgent = await getCustomAgentById(customAgentId, db);
                    if (customAgent) {
                        // Create a dynamic agent instance for custom agents
                        mappedParticipants.push({
                            id: p,
                            customAgent: customAgent
                        });
                    }
                } else {
                    // Handle built-in agents
                    switch(p) {
                        case 'deputy_editor': 
                            mappedParticipants.push('deputy-editor-1');
                            break;
                        case 'writer': 
                            mappedParticipants.push('writer-1');
                            break;
                        case 'editor': 
                            mappedParticipants.push('editor-1');
                            break;
                        case 'proofreader': 
                            mappedParticipants.push('proofreader-1');
                            break;
                    }
                }
            }
            
            // Start session in coordinator
            await agentCoordinator.startSession(sessionId, {
                type,
                participants: mappedParticipants
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
            const { sessionId, message, role, plotAspect } = data;
            
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
            
            // Handle plot creation mode differently
            if (session.type === 'plot_creation') {
                const results = await agentCoordinator.discussPlotCreation({
                    sessionId,
                    message,
                    context: session.context,
                    plotAspect: plotAspect || 'general'
                });
                
                // Process agent responses
                for (const result of results) {
                    mainWindow.webContents.send('agents:message', {
                        sessionId,
                        agentType: getAgentTypeFromId(result.agentId),
                        message: result.contribution.suggestion || result.contribution.viewpoint || result.contribution,
                        plotElements: result.plotElements,
                        timestamp: new Date()
                    });
                    
                    // Add to session history
                    session.messages.push({
                        role: result.agentId,
                        content: result.contribution,
                        plotElements: result.plotElements,
                        timestamp: new Date()
                    });
                }
            } else {
                // Regular discussion mode
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
    
    // Generate plot from session
    ipcMain.handle('agents:generatePlot', async (event, data) => {
        try {
            const { sessionId } = data;
            
            const session = activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            
            if (session.type !== 'plot_creation') {
                throw new Error('Session is not a plot creation session');
            }
            
            // Generate final plot
            const plot = await agentCoordinator.generateFinalPlot(sessionId);
            
            // Notify frontend
            mainWindow.webContents.send('agents:plotGenerated', {
                sessionId,
                plot
            });
            
            return { success: true, plot };
        } catch (error) {
            logger.error('Failed to generate plot:', error);
            throw error;
        }
    });
    
    // Get current plot elements
    ipcMain.handle('agents:getPlotElements', async (event, data) => {
        try {
            const { sessionId } = data;
            
            const session = agentCoordinator.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            
            return {
                success: true,
                plotElements: session.plotElements || null
            };
        } catch (error) {
            logger.error('Failed to get plot elements:', error);
            throw error;
        }
    });
    
    // Create custom agent
    ipcMain.handle('agent:create', async (event, agentData) => {
        try {
            logger.info('Creating custom agent:', agentData.name);
            
            // Generate unique ID
            const agentId = `custom-${uuidv4()}`;
            
            // Store custom agent
            const customAgent = {
                id: agentId,
                ...agentData,
                createdAt: new Date().toISOString(),
                isCustom: true
            };
            
            // Save to database (using settings repository for now)
            const SettingsRepository = require('../repositories/settings-repository');
            const settingsRepo = new SettingsRepository(db);
            
            // Get existing custom agents
            const existingAgents = await settingsRepo.get('customAgents') || [];
            
            // Add new agent
            existingAgents.push(customAgent);
            
            // Save back
            await settingsRepo.set('customAgents', existingAgents);
            
            logger.info('Custom agent created successfully:', agentId);
            
            return {
                success: true,
                data: customAgent
            };
        } catch (error) {
            logger.error('Failed to create custom agent:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    
    // Get custom agents
    ipcMain.handle('agent:getCustom', async (event) => {
        try {
            const SettingsRepository = require('../repositories/settings-repository');
            const settingsRepo = new SettingsRepository(db);
            
            const customAgents = await settingsRepo.get('customAgents') || [];
            
            return {
                success: true,
                data: customAgents
            };
        } catch (error) {
            logger.error('Failed to get custom agents:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    
    // Delete custom agent
    ipcMain.handle('agent:delete', async (event, agentId) => {
        try {
            const SettingsRepository = require('../repositories/settings-repository');
            const settingsRepo = new SettingsRepository(db);
            
            const customAgents = await settingsRepo.get('customAgents') || [];
            const filteredAgents = customAgents.filter(agent => agent.id !== agentId);
            
            await settingsRepo.set('customAgents', filteredAgents);
            
            logger.info('Custom agent deleted:', agentId);
            
            return {
                success: true
            };
        } catch (error) {
            logger.error('Failed to delete custom agent:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    
    // Workflow handlers
    ipcMain.handle('workflow:start', async (event, data) => {
        try {
            const { projectId, options } = data;
            
            logger.info(`Starting workflow for project ${projectId}`);
            
            const workflow = await workflowCoordinator.startWorkflow(projectId, options);
            
            // Setup workflow event forwarding
            setupWorkflowEventForwarding(workflow.id, mainWindow);
            
            return { success: true, data: workflow };
        } catch (error) {
            logger.error('Failed to start workflow:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('workflow:get', async (event, data) => {
        try {
            const { workflowId } = data;
            const workflow = workflowCoordinator.getWorkflow(workflowId);
            
            if (!workflow) {
                throw new Error('Workflow not found');
            }
            
            return { success: true, data: workflow };
        } catch (error) {
            logger.error('Failed to get workflow:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('workflow:transition', async (event, data) => {
        try {
            const { workflowId } = data;
            
            const workflow = await workflowCoordinator.transitionToNextPhase(workflowId);
            
            return { success: true, data: workflow };
        } catch (error) {
            logger.error('Failed to transition workflow:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('workflow:pause', async (event, data) => {
        try {
            const { workflowId } = data;
            
            workflowCoordinator.pauseWorkflow(workflowId);
            
            return { success: true };
        } catch (error) {
            logger.error('Failed to pause workflow:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('workflow:resume', async (event, data) => {
        try {
            const { workflowId } = data;
            
            workflowCoordinator.resumeWorkflow(workflowId);
            
            return { success: true };
        } catch (error) {
            logger.error('Failed to resume workflow:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('workflow:cancel', async (event, data) => {
        try {
            const { workflowId } = data;
            
            workflowCoordinator.cancelWorkflow(workflowId);
            
            return { success: true };
        } catch (error) {
            logger.error('Failed to cancel workflow:', error);
            return { success: false, error: error.message };
        }
    });
    
    logger.info('Agent handlers registered');
}

/**
 * Setup workflow event forwarding
 */
function setupWorkflowEventForwarding(workflowId, mainWindow) {
    const coordinator = workflowCoordinator;
    
    // Forward workflow events
    const events = [
        'workflow:started',
        'workflow:phase-transitioned',
        'workflow:plot-creation-started',
        'workflow:plot-progress',
        'workflow:plot-completed',
        'workflow:writing-started',
        'workflow:chapter-completed',
        'workflow:review-started',
        'workflow:completed',
        'workflow:paused',
        'workflow:resumed',
        'workflow:cancelled'
    ];
    
    events.forEach(event => {
        coordinator.on(event, (data) => {
            if (data.workflowId === workflowId) {
                mainWindow.webContents.send(event, data);
            }
        });
    });
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
    coordinator.removeAllListeners('plot:updated');
    coordinator.removeAllListeners('plot:generated');
    
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
                plotElements: data.plotElements,
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
    
    // Forward plot updates
    coordinator.on('plot:updated', (data) => {
        if (data.sessionId === sessionId) {
            mainWindow.webContents.send('agents:plotUpdated', {
                sessionId,
                plotElements: data.plotElements
            });
        }
    });
    
    // Forward plot generation
    coordinator.on('plot:generated', (data) => {
        if (data.sessionId === sessionId) {
            mainWindow.webContents.send('agents:plotGenerated', {
                sessionId,
                plot: data.plot
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
    // Handle custom agents
    if (agentId.startsWith('custom_') || agentId.startsWith('custom-')) {
        return agentId;
    }
    
    const mapping = {
        'deputy-editor-1': 'deputy_editor',
        'writer-1': 'writer',
        'editor-1': 'editor',
        'proofreader-1': 'proofreader'
    };
    
    return mapping[agentId] || 'unknown';
}

/**
 * Get custom agent by ID
 */
async function getCustomAgentById(agentId, db) {
    try {
        const SettingsRepository = require('../repositories/settings-repository');
        const settingsRepo = new SettingsRepository(db);
        
        const customAgents = await settingsRepo.get('customAgents') || [];
        return customAgents.find(agent => agent.id === agentId);
    } catch (error) {
        logger.error('Failed to get custom agent:', error);
        return null;
    }
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