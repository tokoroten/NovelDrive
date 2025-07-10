const { getLogger } = require('../utils/logger');
const openAIService = require('./openai-service');

/**
 * URL Discussion Service
 * URLコンテンツからAIエージェントが議論して小説のアイディアを生成
 */
class URLDiscussionService {
  constructor(repositories) {
    this.logger = getLogger('url-discussion-service');
    this.repositories = repositories;
    this.agents = {
      analyst: {
        name: '分析者',
        role: 'URLコンテンツから重要な情報や興味深い要素を抽出する',
        personality: '論理的で詳細志向。事実を正確に把握し、隠れた意味や関連性を見つけるのが得意。'
      },
      creative: {
        name: '創造者',
        role: '抽出された情報から創造的な小説のアイディアを発想する',
        personality: '想像力豊かで自由な発想が得意。既存の枠にとらわれない斬新なアイディアを生み出す。'
      },
      editor: {
        name: '編集者',
        role: '生成されたアイディアを整理し、実用的な小説企画にまとめる',
        personality: '実践的で構成力がある。アイディアを物語として成立させる方法を考える。'
      }
    };
  }

  /**
   * URLコンテンツから議論してアイディアを生成
   * @param {Object} urlContent - fetchURLContentの結果
   * @param {number} projectId
   * @returns {Promise<Object>}
   */
  async generateIdeasFromURL(urlContent, projectId) {
    try {
      this.logger.info('Starting URL discussion for idea generation');
      
      const discussion = {
        url: urlContent.url || 'Unknown URL',
        title: urlContent.title,
        startTime: new Date(),
        stages: []
      };

      // Stage 1: 分析者による情報抽出
      const analysis = await this.analyzeContent(urlContent);
      discussion.stages.push({
        agent: 'analyst',
        stage: 'analysis',
        content: analysis,
        timestamp: new Date()
      });

      // Stage 2: 創造者によるアイディア発想
      const creativeIdeas = await this.generateCreativeIdeas(analysis);
      discussion.stages.push({
        agent: 'creative',
        stage: 'ideation',
        content: creativeIdeas,
        timestamp: new Date()
      });

      // Stage 3: 編集者による企画整理
      const refinedIdeas = await this.refineIdeas(creativeIdeas, analysis);
      discussion.stages.push({
        agent: 'editor',
        stage: 'refinement',
        content: refinedIdeas,
        timestamp: new Date()
      });

      // Stage 4: 全員での最終議論
      const finalDiscussion = await this.finalDiscussion(analysis, creativeIdeas, refinedIdeas);
      discussion.stages.push({
        agent: 'all',
        stage: 'final_discussion',
        content: finalDiscussion,
        timestamp: new Date()
      });

      discussion.endTime = new Date();
      discussion.duration = discussion.endTime - discussion.startTime;

      // 結果を保存
      const savedIdeas = await this.saveGeneratedIdeas(projectId, discussion, finalDiscussion);

      return {
        discussion,
        ideas: savedIdeas,
        summary: this.createSummary(finalDiscussion)
      };
    } catch (error) {
      this.logger.error('Failed to generate ideas from URL:', error);
      throw error;
    }
  }

  /**
   * Stage 1: コンテンツ分析
   */
  async analyzeContent(urlContent) {
    const prompt = `
あなたは${this.agents.analyst.name}です。
${this.agents.analyst.personality}

以下のWebページの内容を分析し、小説創作に役立つ要素を抽出してください：

タイトル: ${urlContent.title}
説明: ${urlContent.description}
内容: ${urlContent.summary || urlContent.content.substring(0, 2000)}

以下の観点から分析してください：
1. 主要なテーマや概念
2. 興味深い事実や現象
3. 人物、場所、出来事
4. 感情的な要素や雰囲気
5. 小説の題材として使える可能性のある要素

分析結果を詳しく説明してください。
`;

    const analysis = await openAIService.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 1000
    });

    return {
      agent: this.agents.analyst.name,
      analysis,
      extractedElements: this.extractKeyElements(analysis)
    };
  }

  /**
   * Stage 2: 創造的アイディア生成
   */
  async generateCreativeIdeas(analysis) {
    const prompt = `
あなたは${this.agents.creative.name}です。
${this.agents.creative.personality}

${this.agents.analyst.name}が以下の分析を行いました：
${analysis.analysis}

この分析を基に、斬新で面白い小説のアイディアを5つ以上生成してください。
各アイディアには以下を含めてください：
1. ジャンル（SF、ファンタジー、ミステリー、恋愛、etc）
2. 基本的なあらすじ（3-5行）
3. 主人公の設定
4. 独自性のある要素
5. 想定される読者層

既存の作品とは違う、オリジナリティのあるアイディアを心がけてください。
`;

    const ideas = await openAIService.generateText(prompt, {
      temperature: 0.9,
      maxTokens: 1500
    });

    return {
      agent: this.agents.creative.name,
      ideas,
      ideaList: this.parseIdeas(ideas)
    };
  }

  /**
   * Stage 3: アイディア精錬
   */
  async refineIdeas(creativeIdeas, analysis) {
    const prompt = `
あなたは${this.agents.editor.name}です。
${this.agents.editor.personality}

${this.agents.analyst.name}の分析：
${analysis.analysis.substring(0, 500)}...

${this.agents.creative.name}のアイディア：
${creativeIdeas.ideas}

これらのアイディアを実際の小説企画として整理してください：
1. 最も有望な3つのアイディアを選択
2. それぞれについて以下を詳細化：
   - プロット概要（起承転結）
   - キャラクター設定（主要人物3名以上）
   - 世界観設定
   - テーマとメッセージ
   - 想定文字数と章構成

実現可能性と面白さのバランスを考慮してください。
`;

    const refinedIdeas = await openAIService.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 1500
    });

    return {
      agent: this.agents.editor.name,
      refinedIdeas,
      proposals: this.parseProposals(refinedIdeas)
    };
  }

  /**
   * Stage 4: 最終議論
   */
  async finalDiscussion(analysis, creativeIdeas, refinedIdeas) {
    const prompt = `
小説創作のためのAIエージェント会議の最終段階です。

参加者：
- ${this.agents.analyst.name}：情報分析担当
- ${this.agents.creative.name}：アイディア創造担当
- ${this.agents.editor.name}：企画整理担当

これまでの議論：
1. 分析結果の要点：${analysis.analysis.substring(0, 300)}...
2. 創造的アイディアの要点：${creativeIdeas.ideas.substring(0, 300)}...
3. 整理された企画の要点：${refinedIdeas.refinedIdeas.substring(0, 300)}...

3人のエージェントで議論し、最終的な小説企画を1つ決定してください。
議論では以下を含めてください：
- 各エージェントの視点からの意見
- 選ばれた企画の強みと課題
- 実際の執筆に向けた具体的なアドバイス
- 追加で必要な調査や準備

会話形式で議論を進めてください。
`;

    const discussion = await openAIService.generateText(prompt, {
      temperature: 0.8,
      maxTokens: 2000
    });

    return {
      discussion,
      finalDecision: this.extractFinalDecision(discussion)
    };
  }

  /**
   * アイディアを保存
   */
  async saveGeneratedIdeas(projectId, discussion, finalDiscussion) {
    try {
      const ideas = [];
      
      // 最終決定されたアイディアを保存
      if (finalDiscussion.finalDecision) {
        const mainIdea = {
          project_id: projectId,
          type: 'url_generated_idea',
          title: finalDiscussion.finalDecision.title || 'URLから生成されたアイディア',
          content: JSON.stringify({
            url: discussion.url,
            urlTitle: discussion.title,
            decision: finalDiscussion.finalDecision,
            discussion: discussion.stages.map(s => ({
              agent: s.agent,
              stage: s.stage,
              summary: s.content.agent ? s.content.agent + ': ' + (s.content.analysis || s.content.ideas || s.content.refinedIdeas || '').substring(0, 200) : ''
            }))
          }),
          metadata: JSON.stringify({
            source: 'url_discussion',
            generatedAt: new Date().toISOString(),
            discussionDuration: discussion.duration,
            agents: Object.keys(this.agents)
          })
        };
        
        const savedIdea = await this.repositories.knowledge.create(mainIdea);
        ideas.push(savedIdea);
      }
      
      // サブアイディアも保存（もしあれば）
      const creativeStage = discussion.stages.find(s => s.stage === 'ideation');
      if (creativeStage && creativeStage.content.ideaList) {
        for (const idea of creativeStage.content.ideaList.slice(0, 3)) {
          const subIdea = {
            project_id: projectId,
            type: 'url_sub_idea',
            title: idea.title || 'サブアイディア',
            content: idea.summary || idea.description || '',
            metadata: JSON.stringify({
              source: 'url_discussion',
              parentUrl: discussion.url,
              ideaType: 'alternative',
              genre: idea.genre
            })
          };
          
          const saved = await this.repositories.knowledge.create(subIdea);
          ideas.push(saved);
        }
      }
      
      return ideas;
    } catch (error) {
      this.logger.error('Failed to save generated ideas:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  extractKeyElements(analysis) {
    // 分析から重要な要素を抽出（簡易実装）
    const elements = {
      themes: [],
      facts: [],
      entities: [],
      emotions: []
    };
    
    // 実際にはより高度な自然言語処理が必要
    return elements;
  }

  parseIdeas(ideasText) {
    // テキストからアイディアリストを解析（簡易実装）
    const ideas = [];
    const sections = ideasText.split(/\d+\./);
    
    for (const section of sections) {
      if (section.trim()) {
        ideas.push({
          description: section.trim(),
          summary: section.substring(0, 200)
        });
      }
    }
    
    return ideas;
  }

  parseProposals(proposalsText) {
    // 企画提案を解析（簡易実装）
    return [{
      text: proposalsText,
      summary: proposalsText.substring(0, 300)
    }];
  }

  extractFinalDecision(discussionText) {
    // 最終決定を抽出（簡易実装）
    return {
      title: '生成された小説企画',
      summary: discussionText.substring(discussionText.length - 500),
      fullText: discussionText
    };
  }

  createSummary(finalDiscussion) {
    return {
      decision: finalDiscussion.finalDecision.title,
      keyPoints: finalDiscussion.finalDecision.summary,
      nextSteps: '執筆に向けた準備を開始してください'
    };
  }
}

module.exports = URLDiscussionService;