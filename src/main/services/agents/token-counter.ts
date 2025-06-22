/**
 * Token counting service for estimating token usage in messages
 */

export interface TokenCountResult {
  text: string;
  tokenCount: number;
  estimatedCost?: number;
}

export interface ModelTokenLimits {
  maxContextTokens: number;
  maxOutputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export class TokenCounter {
  private static modelLimits: Record<string, ModelTokenLimits> = {
    'gpt-4-turbo-preview': {
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
    },
    'gpt-4': {
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      inputCostPer1k: 0.03,
      outputCostPer1k: 0.06,
    },
    'gpt-3.5-turbo': {
      maxContextTokens: 16384,
      maxOutputTokens: 4096,
      inputCostPer1k: 0.0005,
      outputCostPer1k: 0.0015,
    },
  };

  /**
   * Count tokens in a text string
   * Uses a heuristic approach optimized for Japanese and English text
   */
  static countTokens(text: string): number {
    // For Japanese characters: approximately 1 token per 2 characters
    // For English/ASCII: approximately 1 token per 4 characters
    // This is a reasonable approximation for GPT models
    
    const japanesePattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]/g;
    const japaneseMatches = text.match(japanesePattern) || [];
    const japaneseChars = japaneseMatches.length;
    
    // Count other characters (non-Japanese)
    const otherChars = text.length - japaneseChars;
    
    // Estimate tokens
    const japaneseTokens = Math.ceil(japaneseChars / 2);
    const otherTokens = Math.ceil(otherChars / 4);
    
    return japaneseTokens + otherTokens;
  }

  /**
   * Count tokens for multiple messages
   */
  static countMessagesTokens(messages: Array<{ role: string; content: string }>): number {
    // Account for message formatting overhead (role, separators, etc.)
    const messageOverhead = 4; // Approximate tokens per message
    
    let totalTokens = 0;
    for (const message of messages) {
      totalTokens += this.countTokens(message.content) + messageOverhead;
      totalTokens += this.countTokens(message.role);
    }
    
    return totalTokens;
  }

  /**
   * Estimate if messages will exceed token limit
   */
  static willExceedLimit(
    messages: Array<{ role: string; content: string }>,
    model: string = 'gpt-4-turbo-preview',
    bufferTokens: number = 1000 // Reserve tokens for response
  ): boolean {
    const limits = this.modelLimits[model];
    if (!limits) {
      console.warn(`Unknown model: ${model}, using default limits`);
      return false;
    }

    const currentTokens = this.countMessagesTokens(messages);
    const threshold = limits.maxContextTokens - bufferTokens - limits.maxOutputTokens;
    
    return currentTokens >= threshold;
  }

  /**
   * Calculate percentage of token limit used
   */
  static getTokenUsagePercentage(
    messages: Array<{ role: string; content: string }>,
    model: string = 'gpt-4-turbo-preview'
  ): number {
    const limits = this.modelLimits[model];
    if (!limits) return 0;

    const currentTokens = this.countMessagesTokens(messages);
    return (currentTokens / limits.maxContextTokens) * 100;
  }

  /**
   * Get safe token limit for summarization trigger
   */
  static getSafeTokenLimit(model: string = 'gpt-4-turbo-preview'): number {
    const limits = this.modelLimits[model];
    if (!limits) return 100000; // Default fallback

    // Use 70% of max context as safe limit to leave room for responses and summaries
    return Math.floor(limits.maxContextTokens * 0.7);
  }

  /**
   * Estimate cost for token usage
   */
  static estimateCost(
    inputTokens: number,
    outputTokens: number,
    model: string = 'gpt-4-turbo-preview'
  ): number {
    const limits = this.modelLimits[model];
    if (!limits) return 0;

    const inputCost = (inputTokens / 1000) * limits.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * limits.outputCostPer1k;
    
    return inputCost + outputCost;
  }

  /**
   * Get model token limits
   */
  static getModelLimits(model: string): ModelTokenLimits | undefined {
    return this.modelLimits[model];
  }

  /**
   * Analyze text for token distribution
   */
  static analyzeText(text: string): TokenCountResult & {
    japaneseRatio: number;
    averageTokenLength: number;
  } {
    const tokenCount = this.countTokens(text);
    const japaneseChars = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length;
    const japaneseRatio = text.length > 0 ? japaneseChars / text.length : 0;
    const averageTokenLength = tokenCount > 0 ? text.length / tokenCount : 0;

    return {
      text,
      tokenCount,
      japaneseRatio,
      averageTokenLength,
    };
  }
}