import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  createThread, 
  createAssistant, 
  addMessageToThread, 
  runAssistant, 
  getThreadMessages,
  deleteThread 
} from './openai-service';
import { performSerendipitySearch } from './serendipity-search';

// エージェントのタイプ
export type AgentRole = 'writer' | 'editor' | 'proofreader' | 'deputy_editor';

// エージェントの人格タイプ
export type PersonalityType = 
  | 'experimental' // 実験的・挑戦的
  | 'traditional' // 伝統的・保守的
  | 'logical' // 論理的・分析的
  | 'emotional' // 感情的・直感的
  | 'commercial'; // 商業的・市場志向

// メッセージインターフェース
export interface AgentMessage {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  content: string;
  timestamp: Date;
  inReplyTo?: string;
  metadata?: {
    confidence?: number;
    emotionalTone?: string;
    tokensUsed?: number;
    threadId?: string;
  };
}

// 議論セッションインターフェース
export interface DiscussionSession {
  id: string;
  projectId?: string;
  plotId?: string;
  topic: string;
  participants: Agent[];
  messages: AgentMessage[];
  status: 'active' | 'paused' | 'concluded';
  startTime: Date;
  endTime?: Date;
  summary?: string;
  decisions?: string[];
}

// エージェントクラス
export class Agent extends EventEmitter {
  id: string;
  role: AgentRole;
  personality: PersonalityType;
  name: string;
  systemPrompt: string;
  temperature: number;
  private conn: any; // DuckDB connection
  private threadId: string | null = null;
  private assistantId: string | null = null;

  constructor(
    role: AgentRole,
    personality: PersonalityType,
    conn: any,
    options?: {
      name?: string;
      temperature?: number;
      customPrompt?: string;
    }
  ) {
    super();
    this.id = uuidv4();
    this.role = role;
    this.personality = personality;
    this.conn = conn;
    this.name = options?.name || this.generateName();
    this.temperature = options?.temperature ?? this.getDefaultTemperature();
    this.systemPrompt = options?.customPrompt || this.generateSystemPrompt();
  }

  async initialize(): Promise<void> {
    // スレッドとアシスタントを作成
    this.threadId = await createThread({
      agentId: this.id,
      role: this.role,
      personality: this.personality,
      name: this.name,
    });
    
    this.assistantId = await createAssistant(
      this.name,
      this.systemPrompt,
      'gpt-4-turbo-preview',
      this.temperature
    );
  }

  private generateName(): string {
    const names = {
      writer: {
        experimental: '実験作家・霧島',
        traditional: '純文学作家・青山',
        logical: '構成作家・理沙',
        emotional: '感性作家・紫苑',
        commercial: 'エンタメ作家・陽菜',
      },
      editor: {
        experimental: '革新編集・夏目',
        traditional: '伝統編集・冬樹',
        logical: '分析編集・数馬',
        emotional: '感性編集・心音',
        commercial: '商業編集・金城',
      },
      proofreader: {
        experimental: '革新校閲・詩織',
        traditional: '伝統校閲・厳太',
        logical: '論理校閲・証',
        emotional: '感性校閲・響',
        commercial: '市場校閲・商子',
      },
      deputy_editor: {
        experimental: '革新副編・未来',
        traditional: '伝統副編・歴史',
        logical: '分析副編・統計',
        emotional: '感性副編・直感',
        commercial: '商業副編・売上',
      },
    };
    
    return names[this.role][this.personality] || `${this.role}-${this.personality}`;
  }

  private getDefaultTemperature(): number {
    const temperatures = {
      writer: { experimental: 0.9, traditional: 0.6, logical: 0.5, emotional: 0.8, commercial: 0.7 },
      editor: { experimental: 0.7, traditional: 0.5, logical: 0.4, emotional: 0.6, commercial: 0.5 },
      proofreader: { experimental: 0.4, traditional: 0.3, logical: 0.2, emotional: 0.4, commercial: 0.3 },
      deputy_editor: { experimental: 0.6, traditional: 0.4, logical: 0.3, emotional: 0.5, commercial: 0.4 },
    };
    
    return temperatures[this.role][this.personality] || 0.5;
  }

  private generateSystemPrompt(): string {
    const basePrompts = {
      writer: `あなたは${this.name}です。創造的な小説家として、独自の視点で物語を紡ぎ出します。`,
      editor: `あなたは${this.name}です。編集者として、物語の構成と読者体験を重視します。`,
      proofreader: `あなたは${this.name}です。校閲者として、矛盾や設定ミスを見逃しません。`,
      deputy_editor: `あなたは${this.name}です。副編集長として、作品の総合的な評価を行います。`,
    };

    const personalityTraits = {
      experimental: '革新的で実験的なアプローチを好み、既存の枠にとらわれません。',
      traditional: '伝統的な手法を重視し、確立された方法論を大切にします。',
      logical: '論理的で分析的な思考を重視し、データと根拠に基づいて判断します。',
      emotional: '感情と直感を大切にし、読者の心に響く要素を重視します。',
      commercial: '市場性と商業的成功を重視し、読者ニーズを的確に捉えます。',
    };

    const roleSpecific = {
      writer: `
- 他のAIや人間の意見を「程よく無視」し、創造性を優先します
- 常にセレンディピティ検索を活用し、予期せぬ組み合わせを探します
- キャラクター対話は【意図】形式で記述します（例：太郎【感謝を伝える】）
- 「それは面白くない」という批判には独自の美学で反論します`,
      editor: `
- 物語の構成とペース配分を重視します
- 読者視点での混乱や違和感を指摘します
- 感情バランスの調整を提案します
- 作家の暴走を適度に制御しますが、創造性も尊重します`,
      proofreader: `
- 文体の一貫性（敬語/口語の統一）をチェックします
- 時制の一貫性（過去形/現在形の混在）を監視します
- 視点の一貫性（一人称/三人称の切り替わり）を確認します
- 矛盾や設定ミスを容赦なく指摘します`,
      deputy_editor: `
- 因果応報性と読者の納得感を評価します
- ジャンル慣習との適合性を確認します
- 市場性の観点から作品を評価します（60点以上が基準）
- 独創性スコア（50点以上）と総合評価（65点以上）を判定します`,
    };

    return `${basePrompts[this.role]}
${personalityTraits[this.personality]}
${roleSpecific[this.role]}

議論では建設的で具体的な意見を述べ、他のエージェントの意見も考慮しながら、
あなたの役割と性格に基づいた独自の視点を提供してください。`;
  }

  async generateResponse(
    context: AgentMessage[],
    topic: string,
    projectId?: string
  ): Promise<AgentMessage> {
    if (!this.threadId || !this.assistantId) {
      await this.initialize();
    }

    // 作家AIの場合はセレンディピティ検索を実行
    let serendipityContext = '';
    if (this.role === 'writer' && projectId) {
      try {
        const searchResults = await performSerendipitySearch(
          this.conn,
          topic,
          {
            projectId,
            limit: 5,
            serendipityLevel: 0.5,
          }
        );
        
        if (searchResults.length > 0) {
          serendipityContext = '\n\n【セレンディピティ検索で発見した関連要素】\n';
          searchResults.forEach((result) => {
            serendipityContext += `- ${result.title}: ${result.content.substring(0, 100)}...\n`;
          });
        }
      } catch (error) {
        console.error('Serendipity search error:', error);
      }
    }

    // コンテキストメッセージを構築
    let contextMessage = `議題: ${topic}${serendipityContext}\n\n`;
    
    // 他のエージェントの発言を追加
    if (context.length > 0) {
      contextMessage += '【これまでの議論】\n';
      const recentContext = context.slice(-10);
      recentContext.forEach((msg) => {
        contextMessage += `[${msg.agentRole}・${msg.id.substring(0, 8)}] ${msg.content}\n\n`;
      });
    }

    // スレッドにメッセージを追加
    await addMessageToThread(this.threadId!, contextMessage, 'user');

    // アシスタントを実行
    const messages = await runAssistant(this.threadId!, this.assistantId!);
    
    // 最新のアシスタントメッセージを取得
    const latestMessage = messages.find(msg => msg.role === 'assistant');
    if (!latestMessage || typeof latestMessage.content[0] !== 'object' || !('text' in latestMessage.content[0])) {
      throw new Error('No response from assistant');
    }

    const responseContent = latestMessage.content[0].text.value;

    const message: AgentMessage = {
      id: uuidv4(),
      agentId: this.id,
      agentRole: this.role,
      content: responseContent,
      timestamp: new Date(),
      metadata: {
        confidence: 0.8,
        emotionalTone: this.detectEmotionalTone(responseContent),
        threadId: this.threadId || undefined,
      },
    };

    this.emit('message', message);
    return message;
  }

  async cleanup(): Promise<void> {
    if (this.threadId) {
      try {
        await deleteThread(this.threadId);
      } catch (error) {
        console.error('Failed to delete thread:', error);
      }
      this.threadId = null;
    }
    this.assistantId = null;
  }

  private detectEmotionalTone(content: string): string {
    // 簡易的な感情トーン検出
    if (content.includes('素晴らしい') || content.includes('面白い')) return 'positive';
    if (content.includes('問題') || content.includes('懸念')) return 'concerned';
    if (content.includes('提案') || content.includes('どうでしょう')) return 'constructive';
    return 'neutral';
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      personality: this.personality,
      name: this.name,
      temperature: this.temperature,
      threadId: this.threadId,
      assistantId: this.assistantId,
    };
  }
}

// マルチエージェントオーケストレーター
export class MultiAgentOrchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private sessions: Map<string, DiscussionSession> = new Map();
  private conn: any;

  constructor(conn: any) {
    super();
    this.conn = conn;
  }

  async cleanup(): Promise<void> {
    // すべてのエージェントのスレッドをクリーンアップ
    for (const agent of this.agents.values()) {
      await agent.cleanup();
    }
    this.agents.clear();
    this.sessions.clear();
  }

  async createAgent(
    role: AgentRole,
    personality: PersonalityType,
    options?: any
  ): Promise<Agent> {
    const agent = new Agent(role, personality, this.conn, options);
    await agent.initialize();
    this.agents.set(agent.id, agent);
    return agent;
  }

  async startDiscussion(
    topic: string,
    participants: Agent[],
    options?: {
      projectId?: string;
      plotId?: string;
      maxRounds?: number;
    }
  ): Promise<DiscussionSession> {
    const session: DiscussionSession = {
      id: uuidv4(),
      projectId: options?.projectId,
      plotId: options?.plotId,
      topic,
      participants,
      messages: [],
      status: 'active',
      startTime: new Date(),
    };

    this.sessions.set(session.id, session);
    this.emit('sessionStarted', session);

    // 議論を開始
    const maxRounds = options?.maxRounds || 5;
    
    for (let round = 0; round < maxRounds && session.status === 'active'; round++) {
      for (const agent of participants) {
        if (session.status !== 'active') break;
        
        try {
          const message = await agent.generateResponse(
            session.messages,
            topic,
            options?.projectId
          );
          
          session.messages.push(message);
          this.emit('message', { session, message });
          
          // メッセージ間の遅延（リアルタイム感を演出）
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Agent ${agent.name} error:`, error);
        }
      }
    }

    // セッション終了処理
    session.status = 'concluded';
    session.endTime = new Date();
    session.summary = await this.generateSummary(session);
    
    // データベースに保存
    await this.saveSession(session);
    
    this.emit('sessionConcluded', session);
    return session;
  }

  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'active') {
      session.status = 'paused';
      this.emit('sessionPaused', session);
    }
  }

  resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'active';
      this.emit('sessionResumed', session);
    }
  }

  private async generateSummary(session: DiscussionSession): Promise<string> {
    // 要約用の一時スレッドを作成
    const threadId = await createThread({ purpose: 'summary' });
    const assistantId = await createAssistant(
      '議論要約アシスタント',
      '以下の議論を簡潔に要約し、主要な決定事項を抽出してください。',
      'gpt-4-turbo-preview',
      0.3
    );
    
    try {
      const content = session.messages.map(m => `[${m.agentRole}] ${m.content}`).join('\n\n');
      await addMessageToThread(threadId, content, 'user');
      
      const messages = await runAssistant(threadId, assistantId);
      const summaryMessage = messages.find(msg => msg.role === 'assistant');
      
      if (!summaryMessage || typeof summaryMessage.content[0] !== 'object' || !('text' in summaryMessage.content[0])) {
        throw new Error('No summary generated');
      }
      
      return summaryMessage.content[0].text.value;
    } finally {
      // クリーンアップ
      await deleteThread(threadId);
    }
  }

  private async saveSession(session: DiscussionSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO agent_discussions 
        (id, plot_id, participants, messages, conclusion, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.conn.run(sql, [
        session.id,
        session.plotId || null,
        JSON.stringify(session.participants.map(p => p.toJSON())),
        JSON.stringify(session.messages),
        session.summary || null,
        session.status,
        session.startTime,
        session.endTime || new Date(),
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getSession(sessionId: string): DiscussionSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): DiscussionSession[] {
    return Array.from(this.sessions.values());
  }
}