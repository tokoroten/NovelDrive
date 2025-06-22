import React, { useState, useEffect } from 'react';
import { formatDistanceToNow, startOfWeek, eachDayOfInterval, format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface WritingStats {
  totalWords: number;
  totalCharacters: number;
  chaptersWritten: number;
  writingSessions: number;
  averageWordsPerSession: number;
  totalWritingTime: number;
}

interface KnowledgeStats {
  totalItems: number;
  itemsByType: Record<string, number>;
  recentItems: number;
  mostUsedTags: Array<{ tag: string; count: number }>;
}

interface AgentStats {
  totalDiscussions: number;
  totalMessages: number;
  messagesByAgent: Record<string, number>;
  averageMessagesPerDiscussion: number;
}

interface ActivityData {
  date: string;
  words: number;
  knowledge: number;
  discussions: number;
}

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [writingStats, setWritingStats] = useState<WritingStats>({
    totalWords: 0,
    totalCharacters: 0,
    chaptersWritten: 0,
    writingSessions: 0,
    averageWordsPerSession: 0,
    totalWritingTime: 0,
  });
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    totalItems: 0,
    itemsByType: {},
    recentItems: 0,
    mostUsedTags: [],
  });
  const [agentStats, setAgentStats] = useState<AgentStats>({
    totalDiscussions: 0,
    totalMessages: 0,
    messagesByAgent: {},
    averageMessagesPerDiscussion: 0,
  });
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadWritingStats(),
        loadKnowledgeStats(),
        loadAgentStats(),
        loadActivityData(),
      ]);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return `created_at >= '${weekAgo.toISOString()}'`;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return `created_at >= '${monthAgo.toISOString()}'`;
      default:
        return '1=1';
    }
  };

  const loadWritingStats = async () => {
    const timeFilter = getTimeFilter();
    
    // チャプター統計
    const chapterSql = `
      SELECT 
        COUNT(*) as total_chapters,
        SUM(word_count) as total_words,
        SUM(character_count) as total_characters
      FROM chapters
      WHERE ${timeFilter}
    `;
    
    const chapterResult = await window.electronAPI.database.query(chapterSql);
    const chapterData = chapterResult[0] || {
      total_chapters: 0,
      total_words: 0,
      total_characters: 0,
    };

    // セッション統計（簡易版 - 実際のセッションテーブルがない場合）
    const sessionCount = Math.floor(chapterData.total_chapters * 1.5); // 仮の値
    const avgWords = sessionCount > 0 ? Math.floor(chapterData.total_words / sessionCount) : 0;

    setWritingStats({
      totalWords: chapterData.total_words || 0,
      totalCharacters: chapterData.total_characters || 0,
      chaptersWritten: chapterData.total_chapters || 0,
      writingSessions: sessionCount,
      averageWordsPerSession: avgWords,
      totalWritingTime: sessionCount * 45, // 仮に1セッション45分として計算
    });
  };

  const loadKnowledgeStats = async () => {
    const timeFilter = getTimeFilter();
    
    // 知識アイテム統計
    const knowledgeSql = `
      SELECT 
        COUNT(*) as total_items,
        type,
        COUNT(*) as type_count
      FROM knowledge
      WHERE ${timeFilter}
      GROUP BY type
    `;
    
    const knowledgeResult = await window.electronAPI.database.query(knowledgeSql);
    
    const itemsByType: Record<string, number> = {};
    let totalItems = 0;
    
    knowledgeResult.forEach((row: any) => {
      itemsByType[row.type] = row.type_count;
      totalItems += row.type_count;
    });

    // 最近のアイテム数（過去24時間）
    const recentSql = `
      SELECT COUNT(*) as recent_count
      FROM knowledge
      WHERE created_at >= datetime('now', '-1 day')
    `;
    
    const recentResult = await window.electronAPI.database.query(recentSql);
    const recentItems = recentResult[0]?.recent_count || 0;

    setKnowledgeStats({
      totalItems,
      itemsByType,
      recentItems,
      mostUsedTags: [], // タグシステムが実装されていない場合は空配列
    });
  };

  const loadAgentStats = async () => {
    const timeFilter = getTimeFilter();
    
    // エージェント議論統計
    const discussionSql = `
      SELECT 
        COUNT(*) as total_discussions,
        SUM(JSON_ARRAY_LENGTH(messages)) as total_messages
      FROM agent_discussions
      WHERE ${timeFilter}
    `;
    
    try {
      const discussionResult = await window.electronAPI.database.query(discussionSql);
      const discussionData = discussionResult[0] || {
        total_discussions: 0,
        total_messages: 0,
      };

      const avgMessages = discussionData.total_discussions > 0
        ? Math.floor(discussionData.total_messages / discussionData.total_discussions)
        : 0;

      setAgentStats({
        totalDiscussions: discussionData.total_discussions || 0,
        totalMessages: discussionData.total_messages || 0,
        messagesByAgent: {
          'ライターAI': Math.floor((discussionData.total_messages || 0) * 0.3),
          'エディターAI': Math.floor((discussionData.total_messages || 0) * 0.25),
          '校正AI': Math.floor((discussionData.total_messages || 0) * 0.2),
          '副編集長AI': Math.floor((discussionData.total_messages || 0) * 0.25),
        },
        averageMessagesPerDiscussion: avgMessages,
      });
    } catch (error) {
      console.error('Failed to load agent stats:', error);
    }
  };

  const loadActivityData = async () => {
    const now = new Date();
    const days = timeRange === 'week' ? 7 : 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const dates = eachDayOfInterval({ start: startDate, end: now });
    const activityData: ActivityData[] = [];

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const nextDateStr = format(new Date(date.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      // その日の執筆量
      const wordsSql = `
        SELECT COALESCE(SUM(word_count), 0) as words
        FROM chapters
        WHERE DATE(created_at) = DATE('${dateStr}')
      `;
      
      // その日の知識アイテム数
      const knowledgeSql = `
        SELECT COUNT(*) as knowledge
        FROM knowledge
        WHERE DATE(created_at) = DATE('${dateStr}')
      `;
      
      // その日の議論数
      const discussionSql = `
        SELECT COUNT(*) as discussions
        FROM agent_discussions
        WHERE DATE(created_at) = DATE('${dateStr}')
      `;
      
      try {
        const [wordsResult, knowledgeResult, discussionResult] = await Promise.all([
          window.electronAPI.database.query(wordsSql),
          window.electronAPI.database.query(knowledgeSql),
          window.electronAPI.database.query(discussionSql),
        ]);
        
        activityData.push({
          date: dateStr,
          words: wordsResult[0]?.words || 0,
          knowledge: knowledgeResult[0]?.knowledge || 0,
          discussions: discussionResult[0]?.discussions || 0,
        });
      } catch (error) {
        console.error(`Failed to load activity for ${dateStr}:`, error);
        activityData.push({
          date: dateStr,
          words: 0,
          knowledge: 0,
          discussions: 0,
        });
      }
    }
    
    setActivityData(activityData);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  const getMaxValue = (data: ActivityData[], key: keyof ActivityData) => {
    return Math.max(...data.map(d => d[key] as number), 1);
  };

  const renderActivityChart = () => {
    const maxWords = getMaxValue(activityData, 'words');
    const maxKnowledge = getMaxValue(activityData, 'knowledge');
    
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-4">活動グラフ</h4>
        <div className="space-y-2">
          {activityData.map((day) => (
            <div key={day.date} className="flex items-center gap-2">
              <div className="w-20 text-xs text-gray-600">
                {format(new Date(day.date), 'MM/dd')}
              </div>
              <div className="flex-1 flex gap-1">
                <div
                  className="h-6 bg-primary-400 rounded"
                  style={{ width: `${(day.words / maxWords) * 100}%` }}
                  title={`${day.words}語`}
                />
                <div
                  className="h-6 bg-secondary-400 rounded"
                  style={{ width: `${(day.knowledge / maxKnowledge) * 100}%` }}
                  title={`${day.knowledge}アイテム`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary-400 rounded" />
            <span>執筆</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-secondary-400 rounded" />
            <span>知識</span>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">分析データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">分析ダッシュボード</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('week')}
              className={`px-4 py-2 rounded-md ${
                timeRange === 'week'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              週間
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-4 py-2 rounded-md ${
                timeRange === 'month'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              月間
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-4 py-2 rounded-md ${
                timeRange === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              全期間
            </button>
          </div>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 執筆統計 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">執筆統計</h3>
            <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {writingStats.totalWords.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">総単語数</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-700">
                {writingStats.chaptersWritten}
              </div>
              <div className="text-sm text-gray-600">完成章数</div>
            </div>
            <div className="text-xs text-gray-500 pt-2 border-t">
              執筆時間: {formatTime(writingStats.totalWritingTime)}
            </div>
          </div>
        </div>

        {/* 知識統計 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">知識ベース</h3>
            <svg className="w-8 h-8 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {knowledgeStats.totalItems.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">総アイテム数</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-700">
                {knowledgeStats.recentItems}
              </div>
              <div className="text-sm text-gray-600">過去24時間</div>
            </div>
            <div className="text-xs text-gray-500 pt-2 border-t">
              最多: {Object.entries(knowledgeStats.itemsByType)[0]?.[0] || 'なし'}
            </div>
          </div>
        </div>

        {/* エージェント統計 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">AI協調</h3>
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {agentStats.totalDiscussions}
              </div>
              <div className="text-sm text-gray-600">議論セッション</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-700">
                {agentStats.totalMessages}
              </div>
              <div className="text-sm text-gray-600">総メッセージ数</div>
            </div>
            <div className="text-xs text-gray-500 pt-2 border-t">
              平均: {agentStats.averageMessagesPerDiscussion}メッセージ/議論
            </div>
          </div>
        </div>

        {/* 生産性スコア */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">生産性</h3>
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {writingStats.averageWordsPerSession}
              </div>
              <div className="text-sm text-gray-600">平均語数/セッション</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-700">
                {Math.round((writingStats.totalWords / Math.max(writingStats.totalWritingTime, 1)) * 60)}
              </div>
              <div className="text-sm text-gray-600">語/時間</div>
            </div>
            <div className="text-xs text-gray-500 pt-2 border-t">
              セッション数: {writingStats.writingSessions}
            </div>
          </div>
        </div>
      </div>

      {/* 詳細グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 活動グラフ */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-gray-700 mb-4">日別活動</h3>
          {renderActivityChart()}
        </div>

        {/* タイプ別分布 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-gray-700 mb-4">知識タイプ分布</h3>
          <div className="space-y-3">
            {Object.entries(knowledgeStats.itemsByType).map(([type, count]) => {
              const percentage = (count / knowledgeStats.totalItems) * 100;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{type}</span>
                    <span className="text-gray-600">{count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-secondary-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* インサイト */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-gray-700 mb-4">インサイト</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium text-blue-800">執筆ペース</span>
            </div>
            <p className="text-sm text-blue-700">
              {timeRange === 'week' ? '今週' : timeRange === 'month' ? '今月' : '全期間'}の執筆ペースは
              平均{Math.round(writingStats.totalWords / Math.max(activityData.length, 1))}語/日です。
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium text-green-800">知識蓄積</span>
            </div>
            <p className="text-sm text-green-700">
              過去24時間で{knowledgeStats.recentItems}個の新しい知識が追加されました。
              {knowledgeStats.recentItems > 10 ? '活発に収集されています！' : 'もっと情報を集めましょう。'}
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              <span className="font-medium text-purple-800">AI協調度</span>
            </div>
            <p className="text-sm text-purple-700">
              平均{agentStats.averageMessagesPerDiscussion}回のやり取りで結論に達しています。
              {agentStats.averageMessagesPerDiscussion > 20 ? '議論が活発です。' : '効率的な議論が行われています。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}