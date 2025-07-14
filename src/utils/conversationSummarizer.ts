import { ConversationTurn } from '../types';
import { getCurrentProvider } from '../llm';

/**
 * 会話履歴を要約する（スレッドは維持）
 */
export async function summarizeConversation(
  conversation: ConversationTurn[],
  keepRecentCount: number = 10
): Promise<{
  summary: string;
  summaryTurn: ConversationTurn;
}> {
  // 古い会話を取得（最近の会話は要約対象外）
  const oldConversation = conversation.slice(0, -keepRecentCount);
  
  if (oldConversation.length === 0) {
    const noSummaryTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: 'system',
      message: '📋 要約する会話履歴がありません。',
      timestamp: new Date()
    };
    return {
      summary: '',
      summaryTurn: noSummaryTurn
    };
  }
  
  // 要約用のプロンプトを作成
  const conversationText = oldConversation.map(turn => {
    const speaker = turn.speaker === 'user' ? 'ユーザー' : 
                   turn.speaker === 'system' ? 'システム' : 
                   turn.speaker;
    return `${speaker}: ${turn.message}`;
  }).join('\n');
  
  const prompt = `以下の会話履歴を要約してください。重要な決定事項、議論の流れ、作成された内容の要点を含めてください。

# 会話履歴
${conversationText}

# 要約
簡潔に要約してください（最大500文字）:`;

  try {
    const provider = getCurrentProvider();
    const response = await provider.createResponse(
      [
        { role: 'system', content: 'あなたは会話を要約する専門家です。重要な情報を簡潔にまとめてください。' },
        { role: 'user', content: prompt }
      ],
      [],
      { type: 'none' }
    );
    
    // 要約をシステムメッセージとして追加
    const summaryTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: 'system',
      message: `📋 会話履歴の要約（${oldConversation.length}ターン分）:\n${response.output_text || '要約の生成に失敗しました'}`,
      timestamp: new Date()
    };
    
    return {
      summary: response.output_text || '',
      summaryTurn
    };
  } catch (error) {
    console.error('Failed to summarize conversation:', error);
    
    // エラー時の通知
    const errorTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: 'system',
      message: `⚠️ 会話履歴の要約に失敗しました。`,
      timestamp: new Date()
    };
    
    return {
      summary: '',
      summaryTurn: errorTurn
    };
  }
}