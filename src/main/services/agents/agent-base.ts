/**
 * AIエージェントの基底クラス
 */

import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { ApiUsageLogger } from '../api-usage-logger';

export interface AgentMessage {
  id: string;
  agentId: string;
  timestamp: Date;
  content: string;
  inReplyTo?: string;
  metadata?: {
    confidence?: number;
    emotionalTone?: string;
    tokensUsed?: number;
    reasoning?: string;
  };
}

export interface AgentPersonality {
  role: 'writer' | 'editor' | 'proofreader' | 'deputy_editor';
  name: string;
  personality: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface DiscussionContext {
  projectId?: string;
  plotId?: string;
  chapterId?: string;
  topic: string;
  previousMessages: AgentMessage[];
  knowledgeContext?: string;
}

export abstract class BaseAgent {
  protected id: string;
  protected personality: AgentPersonality;
  protected openai: OpenAI;
  protected apiLogger?: ApiUsageLogger;
  protected threadId?: string;

  constructor(
    personality: AgentPersonality,
    openai: OpenAI,
    apiLogger?: ApiUsageLogger
  ) {
    this.id = `${personality.role}-${uuidv4().substring(0, 8)}`;
    this.personality = personality;
    this.openai = openai;
    this.apiLogger = apiLogger;
  }

  /**
   * エージェントのIDを取得
   */
  getId(): string {
    return this.id;
  }

  /**
   * エージェントの役割を取得
   */
  getRole(): string {
    return this.personality.role;
  }

  /**
   * エージェントの名前を取得
   */
  getName(): string {
    return this.personality.name;
  }

  /**
   * エージェントのパーソナリティを取得
   */
  getPersonality(): AgentPersonality {
    return this.personality;
  }

  /**
   * 議論に参加して発言を生成
   */
  async participate(context: DiscussionContext): Promise<AgentMessage> {
    const startTime = Date.now();

    try {
      // システムプロンプトとコンテキストを準備
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(context),
        },
      ];

      // 過去のメッセージを追加
      for (const msg of context.previousMessages) {
        messages.push({
          role: 'assistant',
          content: `[${msg.agentId}]: ${msg.content}`,
        });
      }

      // 現在の議題を追加
      messages.push({
        role: 'user',
        content: this.buildUserPrompt(context),
      });

      // OpenAI APIを呼び出し
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: this.personality.temperature || 0.8,
        max_tokens: this.personality.maxTokens || 1000,
      });

      const duration = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;

      // API使用をログに記録
      if (this.apiLogger && usage) {
        await this.apiLogger.log({
          apiType: 'chat',
          provider: 'openai',
          model: response.model,
          operation: 'agent.participate',
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          durationMs: duration,
          status: 'success',
          metadata: {
            agentId: this.id,
            role: this.personality.role,
            topic: context.topic,
          },
        });
      }

      // エージェントメッセージを作成
      const message: AgentMessage = {
        id: uuidv4(),
        agentId: this.id,
        timestamp: new Date(),
        content,
        metadata: {
          tokensUsed: usage?.total_tokens,
          confidence: this.calculateConfidence(content),
          emotionalTone: this.detectEmotionalTone(content),
        },
      };

      // 最後のメッセージへの返信の場合
      if (context.previousMessages.length > 0) {
        message.inReplyTo = context.previousMessages[context.previousMessages.length - 1].id;
      }

      return message;
    } catch (error) {
      // エラーログを記録
      if (this.apiLogger) {
        await this.apiLogger.log({
          apiType: 'chat',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          operation: 'agent.participate',
          durationMs: Date.now() - startTime,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            agentId: this.id,
            role: this.personality.role,
          },
        });
      }

      throw error;
    }
  }

  /**
   * システムプロンプトを構築
   */
  protected buildSystemPrompt(context: DiscussionContext): string {
    let prompt = this.personality.systemPrompt;

    // プロジェクトコンテキストを追加
    if (context.knowledgeContext) {
      prompt += `\n\n関連する知識・設定:\n${context.knowledgeContext}`;
    }

    return prompt;
  }

  /**
   * ユーザープロンプトを構築（子クラスで実装）
   */
  protected abstract buildUserPrompt(context: DiscussionContext): string;

  /**
   * 発言の自信度を計算（0-1）
   */
  protected calculateConfidence(content: string): number {
    // 簡易的な実装：断定的な表現が多いほど高い自信度
    const confidentPhrases = ['必ず', '間違いなく', '確実に', '明らか', '断言'];
    const uncertainPhrases = ['かもしれない', 'おそらく', '思う', 'かも', '多分'];

    let score = 0.5; // 基準値

    for (const phrase of confidentPhrases) {
      if (content.includes(phrase)) score += 0.1;
    }

    for (const phrase of uncertainPhrases) {
      if (content.includes(phrase)) score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 感情的なトーンを検出
   */
  protected detectEmotionalTone(content: string): string {
    if (content.includes('！') || content.includes('素晴らしい') || content.includes('面白い')) {
      return 'enthusiastic';
    }
    if (content.includes('問題') || content.includes('懸念') || content.includes('心配')) {
      return 'concerned';
    }
    if (content.includes('？') && content.length < 100) {
      return 'questioning';
    }
    return 'neutral';
  }

  /**
   * エージェントのスレッドを初期化（Assistants API使用時）
   */
  async initializeThread(): Promise<string> {
    const response = await this.openai.beta.threads.create();
    this.threadId = response.id;
    return this.threadId;
  }

  /**
   * スレッドIDを取得
   */
  getThreadId(): string | undefined {
    return this.threadId;
  }
}