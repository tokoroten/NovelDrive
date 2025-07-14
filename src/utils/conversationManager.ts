import { ConversationTurn } from '../types';

/**
 * 会話履歴を管理し、要約済みの履歴を適切に処理する
 */
export class ConversationManager {
  private summaryCount: number = 0;
  private lastSummaryIndex: number = -1;

  /**
   * 会話履歴を処理し、古い会話を削除して要約を挿入
   */
  processSummarizedConversation(
    currentConversation: ConversationTurn[],
    summaryTurn: ConversationTurn,
    keepRecentCount: number
  ): ConversationTurn[] {

    // 新しい会話配列を構築
    let newConversation: ConversationTurn[] = [];
    
    // 要約を挿入する位置を決定
    const insertPosition = currentConversation.length - keepRecentCount;
    
    if (insertPosition > 0) {
      // 要約位置より前の会話を保持
      newConversation = [...currentConversation.slice(0, insertPosition)];
      // 要約を挿入
      newConversation.push(summaryTurn);
      // 要約位置より後の会話を追加
      newConversation.push(...currentConversation.slice(insertPosition));
    } else {
      // 会話が少ない場合は先頭に要約を挿入
      newConversation = [summaryTurn, ...currentConversation];
    }

    this.summaryCount++;
    this.lastSummaryIndex = newConversation.findIndex(
      turn => turn === summaryTurn
    );

    return newConversation;
  }

  /**
   * 要約が必要かどうかを判定
   */
  shouldSummarize(
    conversationLength: number,
    threshold: number,
    isSummarizing: boolean
  ): boolean {
    if (isSummarizing) return false;
    
    // 最後の要約以降の会話数を計算
    const turnsSinceLastSummary = this.lastSummaryIndex >= 0
      ? conversationLength - this.lastSummaryIndex - 1
      : conversationLength;
    
    return turnsSinceLastSummary >= threshold;
  }

  /**
   * 要約対象の会話を取得
   */
  getConversationToSummarize(
    conversation: ConversationTurn[],
    keepRecentCount: number
  ): ConversationTurn[] {
    // 最後の要約の位置を探す
    let lastSummaryIdx = -1;
    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].speaker === 'system' && 
          conversation[i].message.includes('📋 会話履歴の要約')) {
        lastSummaryIdx = i;
        break;
      }
    }

    // 要約対象の範囲を決定
    const startIdx = lastSummaryIdx + 1; // 最後の要約の次から
    const endIdx = conversation.length - keepRecentCount; // 最近の会話を除く
    
    if (startIdx >= endIdx) {
      return []; // 要約する会話がない
    }
    
    return conversation.slice(startIdx, endIdx);
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      summaryCount: this.summaryCount,
      lastSummaryIndex: this.lastSummaryIndex
    };
  }
}