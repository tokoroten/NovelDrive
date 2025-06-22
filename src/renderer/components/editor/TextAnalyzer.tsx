import React, { useMemo } from 'react';

interface TextAnalyzerProps {
  content: string;
  isVisible: boolean;
}

interface AnalysisResult {
  averageSentenceLength: number;
  longestSentence: { text: string; length: number };
  shortestSentence: { text: string; length: number };
  paragraphCount: number;
  dialogueRatio: number;
  repetitiveWords: Array<{ word: string; count: number }>;
  readingDifficulty: 'easy' | 'medium' | 'hard';
  estimatedReadingTime: number; // 分
}

export function TextAnalyzer({ content, isVisible }: TextAnalyzerProps) {
  const analysis = useMemo<AnalysisResult>(() => {
    if (!content) {
      return {
        averageSentenceLength: 0,
        longestSentence: { text: '', length: 0 },
        shortestSentence: { text: '', length: 0 },
        paragraphCount: 0,
        dialogueRatio: 0,
        repetitiveWords: [],
        readingDifficulty: 'easy',
        estimatedReadingTime: 0,
      };
    }

    // 文の分割
    const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 0);
    const sentenceLengths = sentences.map(s => s.length);
    
    // 平均文長
    const averageSentenceLength = sentenceLengths.length > 0
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
      : 0;
    
    // 最長・最短の文
    const sortedSentences = sentences
      .map(text => ({ text, length: text.length }))
      .sort((a, b) => b.length - a.length);
    
    const longestSentence = sortedSentences[0] || { text: '', length: 0 };
    const shortestSentence = sortedSentences[sortedSentences.length - 1] || { text: '', length: 0 };
    
    // 段落数
    const paragraphCount = content.split(/\n\n+/).filter(p => p.trim()).length;
    
    // 会話文の割合
    const dialogueMatches = content.match(/「[^」]*」/g) || [];
    const dialogueCharCount = dialogueMatches.join('').length;
    const dialogueRatio = content.length > 0 ? dialogueCharCount / content.length : 0;
    
    // 繰り返し単語の検出
    const words = content
      .replace(/[。、！？「」『』（）]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2); // 2文字以上の単語
    
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    const repetitiveWords = Array.from(wordCount.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
    
    // 読みやすさの判定
    let readingDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (averageSentenceLength < 40 && dialogueRatio > 0.3) {
      readingDifficulty = 'easy';
    } else if (averageSentenceLength > 80 || dialogueRatio < 0.1) {
      readingDifficulty = 'hard';
    }
    
    // 推定読了時間（日本語は1分400字として計算）
    const estimatedReadingTime = Math.ceil(content.length / 400);
    
    return {
      averageSentenceLength,
      longestSentence,
      shortestSentence,
      paragraphCount,
      dialogueRatio,
      repetitiveWords,
      readingDifficulty,
      estimatedReadingTime,
    };
  }, [content]);

  if (!isVisible) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'hard':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '読みやすい';
      case 'medium':
        return '標準的';
      case 'hard':
        return '読みにくい';
      default:
        return '不明';
    }
  };

  return (
    <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-700">文章解析</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">平均文長:</span>
          <span className="ml-2 font-medium">{Math.round(analysis.averageSentenceLength)}文字</span>
        </div>
        
        <div>
          <span className="text-gray-600">段落数:</span>
          <span className="ml-2 font-medium">{analysis.paragraphCount}</span>
        </div>
        
        <div>
          <span className="text-gray-600">会話文の割合:</span>
          <span className="ml-2 font-medium">{Math.round(analysis.dialogueRatio * 100)}%</span>
        </div>
        
        <div>
          <span className="text-gray-600">推定読了時間:</span>
          <span className="ml-2 font-medium">{analysis.estimatedReadingTime}分</span>
        </div>
        
        <div className="col-span-2">
          <span className="text-gray-600">読みやすさ:</span>
          <span className={`ml-2 font-medium ${getDifficultyColor(analysis.readingDifficulty)}`}>
            {getDifficultyLabel(analysis.readingDifficulty)}
          </span>
        </div>
      </div>
      
      {analysis.repetitiveWords.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">頻出単語</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.repetitiveWords.slice(0, 5).map(({ word, count }) => (
              <span
                key={word}
                className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs"
              >
                {word} ({count}回)
              </span>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-2 text-xs text-gray-600">
        <div>
          <span>最長の文:</span>
          <p className="mt-1 p-2 bg-white border border-gray-200 rounded truncate">
            {analysis.longestSentence.text} ({analysis.longestSentence.length}文字)
          </p>
        </div>
      </div>
    </div>
  );
}