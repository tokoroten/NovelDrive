/**
 * Message summarization service for multi-agent discussions
 */

import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { AgentMessage } from './agent-base';
import { TokenCounter } from './token-counter';
import { ApiUsageLogger } from '../api-usage-logger';

export interface SummarizationConfig {
  model?: string;
  maxSummaryTokens?: number;
  minMessagesToSummarize?: number;
  preserveRecentMessages?: number;
  summarizationThreshold?: number; // Percentage of token limit
}

export interface MessageSummary {
  id: string;
  originalMessageIds: string[];
  summary: string;
  keyDecisions: string[];
  importantContext: Record<string, any>;
  tokenCount: number;
  createdAt: Date;
}

export class MessageSummarizer {
  private openai: OpenAI;
  private apiLogger?: ApiUsageLogger;
  private config: Required<SummarizationConfig>;

  constructor(
    openai: OpenAI,
    apiLogger?: ApiUsageLogger,
    config?: SummarizationConfig
  ) {
    this.openai = openai;
    this.apiLogger = apiLogger;
    this.config = {
      model: config?.model || 'gpt-4-turbo-preview',
      maxSummaryTokens: config?.maxSummaryTokens || 2000,
      minMessagesToSummarize: config?.minMessagesToSummarize || 5,
      preserveRecentMessages: config?.preserveRecentMessages || 3,
      summarizationThreshold: config?.summarizationThreshold || 70, // 70% of token limit
    };
  }

  /**
   * Check if summarization is needed
   */
  shouldSummarize(messages: AgentMessage[]): boolean {
    if (messages.length < this.config.minMessagesToSummarize) {
      return false;
    }

    const messageData = messages.map(m => ({
      role: 'assistant',
      content: m.content,
    }));

    const usagePercentage = TokenCounter.getTokenUsagePercentage(
      messageData,
      this.config.model
    );

    return usagePercentage >= this.config.summarizationThreshold;
  }

  /**
   * Summarize a batch of messages
   */
  async summarizeMessages(
    messages: AgentMessage[],
    topic: string,
    preserveRecent: boolean = true
  ): Promise<{
    summary: MessageSummary;
    preservedMessages: AgentMessage[];
    summarizedMessages: AgentMessage[];
  }> {
    const startTime = Date.now();

    // Determine which messages to summarize and which to preserve
    let messagesToSummarize = messages;
    let preservedMessages: AgentMessage[] = [];

    if (preserveRecent && messages.length > this.config.preserveRecentMessages) {
      const splitIndex = messages.length - this.config.preserveRecentMessages;
      messagesToSummarize = messages.slice(0, splitIndex);
      preservedMessages = messages.slice(splitIndex);
    }

    // Create the summarization prompt
    const summaryPrompt = this.createSummaryPrompt(messagesToSummarize, topic);

    try {
      // Call OpenAI to generate summary
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent summaries
        max_tokens: this.config.maxSummaryTokens,
        response_format: { type: 'json_object' },
      });

      const duration = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '{}';
      const usage = response.usage;

      // Log API usage
      if (this.apiLogger && usage) {
        await this.apiLogger.log({
          apiType: 'chat',
          provider: 'openai',
          model: response.model,
          operation: 'message.summarization',
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          durationMs: duration,
          status: 'success',
          metadata: {
            messageCount: messagesToSummarize.length,
            topic,
          },
        });
      }

      // Parse the summary response
      const summaryData = JSON.parse(content);
      
      const summary: MessageSummary = {
        id: uuidv4(),
        originalMessageIds: messagesToSummarize.map(m => m.id),
        summary: summaryData.summary || '',
        keyDecisions: summaryData.keyDecisions || [],
        importantContext: summaryData.importantContext || {},
        tokenCount: TokenCounter.countTokens(summaryData.summary || ''),
        createdAt: new Date(),
      };

      return {
        summary,
        preservedMessages,
        summarizedMessages: messagesToSummarize,
      };
    } catch (error) {
      // Log error
      if (this.apiLogger) {
        await this.apiLogger.log({
          apiType: 'chat',
          provider: 'openai',
          model: this.config.model,
          operation: 'message.summarization',
          durationMs: Date.now() - startTime,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  /**
   * Create a summary message that can be inserted into the discussion
   */
  createSummaryMessage(summary: MessageSummary): AgentMessage {
    const content = this.formatSummaryForDiscussion(summary);
    
    return {
      id: summary.id,
      agentId: 'system-summarizer',
      timestamp: summary.createdAt,
      content,
      metadata: {
        originalMessageCount: summary.originalMessageIds.length,
        tokenCount: summary.tokenCount,
        keyDecisions: summary.keyDecisions,
      },
    };
  }

  /**
   * Get system prompt for summarization
   */
  private getSystemPrompt(): string {
    return `あなたは小説創作のマルチエージェント議論を要約する専門家です。
議論の本質的な内容、重要な決定事項、創造的なアイデアを保持しながら、
簡潔で理解しやすい要約を作成してください。

要約は以下の形式のJSONで出力してください：
{
  "summary": "議論の要約（重要なポイントを網羅的に記述）",
  "keyDecisions": ["決定事項1", "決定事項2", ...],
  "importantContext": {
    "characters": "議論されたキャラクター情報",
    "plot": "プロット関連の重要な内容",
    "worldBuilding": "世界観に関する決定事項",
    "creativeIdeas": "創造的なアイデアや提案",
    "concerns": "提起された懸念事項"
  }
}`;
  }

  /**
   * Create summarization prompt
   */
  private createSummaryPrompt(messages: AgentMessage[], topic: string): string {
    const messageContent = messages.map(msg => {
      const agentRole = this.extractAgentRole(msg.agentId);
      return `[${agentRole}] ${msg.content}`;
    }).join('\n\n---\n\n');

    return `以下は「${topic}」に関するマルチエージェント議論の内容です。
この議論を要約し、重要な決定事項と文脈を抽出してください。

議論内容：
${messageContent}

この議論の要約を作成してください。創造的なアイデア、プロットの詳細、
キャラクター設定、世界観の要素など、小説創作に重要な情報は必ず保持してください。`;
  }

  /**
   * Format summary for insertion into discussion
   */
  private formatSummaryForDiscussion(summary: MessageSummary): string {
    let content = `【これまでの議論の要約】\n\n`;
    content += `${summary.summary}\n\n`;

    if (summary.keyDecisions.length > 0) {
      content += `【主な決定事項】\n`;
      summary.keyDecisions.forEach((decision, index) => {
        content += `${index + 1}. ${decision}\n`;
      });
      content += '\n';
    }

    if (Object.keys(summary.importantContext).length > 0) {
      content += `【重要な文脈】\n`;
      for (const [key, value] of Object.entries(summary.importantContext)) {
        if (value) {
          const label = this.getContextLabel(key);
          content += `- ${label}: ${value}\n`;
        }
      }
    }

    return content;
  }

  /**
   * Extract agent role from agent ID
   */
  private extractAgentRole(agentId: string): string {
    if (agentId.includes('writer')) return '作家AI';
    if (agentId.includes('editor')) return '編集AI';
    if (agentId.includes('proofreader')) return '校閲AI';
    if (agentId.includes('deputy')) return '副編集長AI';
    if (agentId.includes('human')) return '人間（編集長）';
    return agentId;
  }

  /**
   * Get Japanese label for context key
   */
  private getContextLabel(key: string): string {
    const labels: Record<string, string> = {
      characters: 'キャラクター',
      plot: 'プロット',
      worldBuilding: '世界観',
      creativeIdeas: '創造的アイデア',
      concerns: '懸念事項',
    };
    return labels[key] || key;
  }

  /**
   * Estimate tokens after summarization
   */
  estimateTokensAfterSummarization(
    messages: AgentMessage[],
    preserveRecent: boolean = true
  ): number {
    let preservedCount = 0;
    
    if (preserveRecent && messages.length > this.config.preserveRecentMessages) {
      const preservedMessages = messages.slice(-this.config.preserveRecentMessages);
      const preservedData = preservedMessages.map(m => ({
        role: 'assistant',
        content: m.content,
      }));
      preservedCount = TokenCounter.countMessagesTokens(preservedData);
    }

    // Estimate summary size (usually 20-30% of original)
    const summaryEstimate = Math.floor(this.config.maxSummaryTokens * 0.8);
    
    return preservedCount + summaryEstimate;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SummarizationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<SummarizationConfig> {
    return { ...this.config };
  }
}