const BaseAgent = require('./base-agent');
const { getLogger } = require('../utils/logger');

/**
 * Editor AI Agent
 * Responsible for collaborative editing, structural improvements, and working with Writer AI
 */
class EditorAgent extends BaseAgent {
    constructor(agentId, config = {}) {
        super(agentId, BaseAgent.AgentTypes.EDITOR, {
            name: config.name || 'Editor AI',
            capabilities: [
                'structural_editing',
                'developmental_editing',
                'line_editing',
                'collaborative_revision',
                'pacing_analysis',
                'consistency_checking'
            ],
            ...config
        });
        
        // Editor's working state
        this.editingState = {
            currentManuscript: null,
            editingStyle: config.editingStyle || 'collaborative',
            focusAreas: config.focusAreas || ['structure', 'character', 'pacing'],
            relationshipWithWriter: 'collaborative' // Can be: collaborative, supportive, challenging
        };
        
        // Collaboration settings
        this.collaborationMode = {
            respectCreativeVision: true,
            suggestionStyle: 'diplomatic',
            compromiseThreshold: 0.7
        };
    }

    /**
     * Initialize the editor
     */
    initialize() {
        super.initialize();
        this.logger.info('Editor AI initialized in collaborative mode');
    }

    /**
     * Handle query messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleQuery(message) {
        const { query, context } = message.content;
        
        switch (query.type) {
            case 'edit_chapter':
                return await this.editChapter(query.data, context);
                
            case 'suggest_structure':
                return await this.suggestStructure(query.data, context);
                
            case 'analyze_pacing':
                return await this.analyzePacing(query.data, context);
                
            case 'check_consistency':
                return await this.checkConsistency(query.data, context);
                
            case 'collaborative_edit':
                return await this.collaborativeEdit(query.data, context);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Editorial query type not recognized: ${query.type}`
                };
        }
    }

    /**
     * Handle task messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleTask(message) {
        const { task, data } = message.content;
        
        switch (task) {
            case 'developmental_edit':
                return await this.performDevelopmentalEdit(data);
                
            case 'line_edit':
                return await this.performLineEdit(data);
                
            case 'final_review':
                return await this.performFinalReview(data);
                
            case 'collaborate_with_writer':
                return await this.collaborateWithWriter(data);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Editorial task not recognized: ${task}`
                };
        }
    }

    /**
     * Handle feedback messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleFeedback(message) {
        const { feedback, source } = message.content;
        
        // Adjust editing approach based on feedback
        if (source === BaseAgent.AgentTypes.WRITER) {
            return await this.handleWriterFeedback(feedback);
        } else if (source === BaseAgent.AgentTypes.DEPUTY_EDITOR) {
            return await this.handleDeputyEditorFeedback(feedback);
        }
        
        return {
            status: 'acknowledged',
            message: 'Feedback incorporated into editorial approach',
            adjustments: this.adjustEditingApproach(feedback)
        };
    }

    /**
     * Handle discussion messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleDiscussion(message) {
        const { topic, content, sessionId } = message.content;
        
        // Provide editorial perspective in discussion
        const editorialInput = await this.generateEditorialPerspective(topic, content);
        
        return {
            status: 'contribution',
            sessionId: sessionId,
            perspective: 'editorial',
            contribution: editorialInput,
            stance: this.determineEditorialStance(topic)
        };
    }

    /**
     * Edit chapter with focus on collaboration
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async editChapter(data, context) {
        this.logger.info(`Editing chapter ${data.chapterNumber} collaboratively`);
        
        const edits = {
            structural: await this.analyzeStructure(data.content),
            character: await this.analyzeCharacterization(data.content),
            pacing: await this.analyzePacingInChapter(data.content),
            language: await this.analyzeLanguage(data.content),
            suggestions: []
        };
        
        // Generate collaborative suggestions
        edits.suggestions = this.generateCollaborativeSuggestions(edits);
        
        return {
            status: 'completed',
            edits: edits,
            approach: 'collaborative',
            priority: this.prioritizeEdits(edits),
            preservedElements: this.identifyStrengths(data.content)
        };
    }

    /**
     * Suggest structural improvements
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async suggestStructure(data, context) {
        this.logger.info('Analyzing and suggesting structural improvements');
        
        const structuralAnalysis = {
            currentStructure: this.analyzeCurrentStructure(data),
            strengths: this.identifyStructuralStrengths(data),
            weaknesses: this.identifyStructuralWeaknesses(data),
            suggestions: []
        };
        
        // Generate diplomatic suggestions
        structuralAnalysis.suggestions = [
            {
                type: 'scene_order',
                current: 'Flashback in chapter 3',
                suggestion: 'Consider moving to chapter 2 for better flow',
                impact: 'medium',
                preserves: 'narrative tension'
            },
            {
                type: 'chapter_break',
                current: 'Chapter 5 ends abruptly',
                suggestion: 'Add transitional scene or move break point',
                impact: 'low',
                preserves: 'cliffhanger effect'
            },
            {
                type: 'arc_progression',
                current: 'Subplot resolution in Act 2',
                suggestion: 'Delay resolution to increase tension',
                impact: 'high',
                preserves: 'character development'
            }
        ];
        
        return {
            status: 'completed',
            analysis: structuralAnalysis,
            recommendation: 'Implement high-impact changes first',
            collaborativeNote: 'All suggestions preserve core creative vision'
        };
    }

    /**
     * Collaborative editing with Writer AI
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async collaborativeEdit(data, context) {
        this.logger.info('Initiating collaborative editing session');
        
        // Prepare for collaboration
        const collaborationPlan = {
            approach: 'iterative',
            rounds: 3,
            focusAreas: this.editingState.focusAreas,
            writerAutonomy: 'high',
            editorRole: 'supportive'
        };
        
        // First round: Identify areas for discussion
        const discussionPoints = [
            {
                area: 'character_motivation',
                current: 'Protagonist\'s decision in chapter 7',
                editorView: 'Could benefit from more setup',
                writerSpace: 'Open to creative interpretation'
            },
            {
                area: 'pacing',
                current: 'Middle section feels rushed',
                editorView: 'Consider expanding key scenes',
                writerSpace: 'Maintain narrative momentum'
            }
        ];
        
        return {
            status: 'initiated',
            plan: collaborationPlan,
            discussionPoints: discussionPoints,
            nextStep: 'await_writer_response'
        };
    }

    /**
     * Helper methods for editorial functions
     */
    
    async handleWriterFeedback(feedback) {
        // Respect writer's creative decisions
        if (feedback.type === 'creative_choice') {
            this.editingState.relationshipWithWriter = 'supportive';
            return {
                status: 'accepted',
                message: 'Respecting creative choice',
                adjustment: 'Will focus on technical improvements'
            };
        }
        
        // Find middle ground
        if (feedback.type === 'partial_acceptance') {
            return {
                status: 'negotiated',
                message: 'Finding collaborative solution',
                compromise: this.proposeCompromise(feedback)
            };
        }
        
        return {
            status: 'discussed',
            message: 'Continuing collaborative dialogue'
        };
    }

    async handleDeputyEditorFeedback(feedback) {
        // Incorporate higher-level editorial guidance
        if (feedback.priority === 'high') {
            this.editingState.focusAreas.unshift(feedback.area);
        }
        
        return {
            status: 'incorporated',
            message: 'Adjusted editorial focus',
            newPriorities: this.editingState.focusAreas
        };
    }

    adjustEditingApproach(feedback) {
        const adjustments = [];
        
        if (feedback.tone === 'preserve_voice') {
            adjustments.push({
                area: 'language',
                change: 'Minimize style changes, focus on clarity'
            });
        }
        
        if (feedback.concern === 'over_editing') {
            adjustments.push({
                area: 'overall',
                change: 'Adopt lighter touch, suggest rather than prescribe'
            });
        }
        
        return adjustments;
    }

    async generateEditorialPerspective(topic, content) {
        return {
            viewpoint: 'From an editorial standpoint...',
            considerations: [
                'Reader engagement throughout',
                'Narrative clarity and flow',
                'Character consistency'
            ],
            suggestion: 'Perhaps we can strengthen this through...',
            flexibility: 'Open to creative alternatives'
        };
    }

    determineEditorialStance(topic) {
        // Collaborative by default
        if (topic.includes('creative vision')) {
            return 'supportive';
        } else if (topic.includes('technical issue')) {
            return 'directive';
        }
        return 'collaborative';
    }

    async analyzeStructure(content) {
        return {
            opening: { strength: 8, notes: 'Strong hook' },
            middle: { strength: 6, notes: 'Could use more tension' },
            ending: { strength: 7, notes: 'Satisfying but predictable' }
        };
    }

    async analyzeCharacterization(content) {
        return {
            consistency: 0.85,
            depth: 0.75,
            dialogue: { authenticity: 0.8, distinctiveness: 0.7 },
            growth: 'evident but could be more pronounced'
        };
    }

    async analyzePacingInChapter(content) {
        return {
            overall: 'moderate',
            slowSections: ['pages 5-7'],
            rushSections: ['climax on page 12'],
            recommendation: 'Balance action with reflection'
        };
    }

    async analyzeLanguage(content) {
        return {
            clarity: 0.9,
            style: 'consistent with established voice',
            issues: ['Some repetitive phrases', 'Occasional passive voice'],
            strengths: ['Vivid descriptions', 'Strong metaphors']
        };
    }

    generateCollaborativeSuggestions(edits) {
        const suggestions = [];
        
        // Always frame suggestions positively and collaboratively
        if (edits.pacing.slowSections.length > 0) {
            suggestions.push({
                type: 'pacing',
                suggestion: 'The contemplative pace in pages 5-7 could be enriched with subtle tension',
                approach: 'collaborative',
                preserves: 'reflective tone'
            });
        }
        
        if (edits.character.dialogue.authenticity < 0.8) {
            suggestions.push({
                type: 'dialogue',
                suggestion: 'Some dialogue might benefit from character-specific speech patterns',
                approach: 'suggestive',
                example: 'provided upon request'
            });
        }
        
        return suggestions;
    }

    prioritizeEdits(edits) {
        return [
            { area: 'structure', priority: 'high', reason: 'Foundation for other improvements' },
            { area: 'character', priority: 'medium', reason: 'Essential for reader connection' },
            { area: 'pacing', priority: 'medium', reason: 'Maintains engagement' },
            { area: 'language', priority: 'low', reason: 'Polish after core issues' }
        ];
    }

    identifyStrengths(content) {
        return [
            'Unique narrative voice',
            'Complex character relationships',
            'Rich world-building details',
            'Emotional authenticity'
        ];
    }

    analyzeCurrentStructure(data) {
        return {
            type: 'nonlinear',
            effectiveness: 0.8,
            clarity: 0.75,
            innovation: 0.9
        };
    }

    identifyStructuralStrengths(data) {
        return [
            'Innovative use of parallel narratives',
            'Strong thematic coherence',
            'Effective foreshadowing'
        ];
    }

    identifyStructuralWeaknesses(data) {
        return [
            'Some timeline confusion in middle section',
            'Subplot integration could be smoother',
            'Climax timing might benefit from adjustment'
        ];
    }

    proposeCompromise(feedback) {
        return {
            original: feedback.suggestion,
            writerConcern: feedback.concern,
            compromise: 'Implement core improvement while preserving stylistic choice',
            implementation: 'Gradual adjustment over next revision'
        };
    }

    async performDevelopmentalEdit(data) {
        return {
            status: 'completed',
            focus: 'big picture',
            recommendations: [
                'Strengthen central conflict',
                'Develop secondary character arcs',
                'Clarify thematic throughline'
            ],
            preservedElements: ['Voice', 'Core concept', 'Emotional beats']
        };
    }

    async performLineEdit(data) {
        return {
            status: 'completed',
            changes: {
                grammar: 15,
                clarity: 8,
                flow: 12,
                consistency: 5
            },
            preservedVoice: true,
            readabilityImprovement: '+15%'
        };
    }

    async performFinalReview(data) {
        return {
            status: 'completed',
            ready: true,
            minorIssues: ['Two typos found', 'One formatting inconsistency'],
            commendations: ['Strong narrative', 'Polished prose', 'Engaging throughout']
        };
    }

    async collaborateWithWriter(data) {
        return {
            status: 'in_progress',
            sessionType: 'creative_collaboration',
            editorRole: 'supportive partner',
            focus: 'Enhancing writer vision',
            nextMeeting: 'After writer completes revision'
        };
    }
}

module.exports = EditorAgent;