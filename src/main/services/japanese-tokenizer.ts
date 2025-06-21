import * as TinySegmenter from 'tiny-segmenter';

// TinySegmenterのインスタンスを作成
const segmenter = new (TinySegmenter as any)();

/**
 * 日本語テキストをトークン化する
 * @param text トークン化するテキスト
 * @returns トークンの配列
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // TinySegmenterでセグメント化
  const tokens = segmenter.segment(text);
  
  // 空白文字や記号のみのトークンを除外
  return tokens.filter((token: string) => {
    // 空白文字のみのトークンを除外
    if (!token.trim()) return false;
    
    // 単一の句読点や記号を除外（ただし、意味のある記号は残す）
    if (token.length === 1 && /[、。，．,.\s]/.test(token)) return false;
    
    return true;
  });
}

/**
 * トークン化された結果を正規化する（検索用）
 * @param tokens トークンの配列
 * @returns 正規化されたトークンの配列
 */
export function normalizeTokens(tokens: string[]): string[] {
  return tokens.map(token => {
    // 全角英数字を半角に変換
    let normalized = token.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    
    // カタカナをひらがなに変換（検索の柔軟性向上）
    normalized = normalized.replace(/[\u30A1-\u30F6]/g, (match) => {
      const code = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(code);
    });
    
    // 小文字に統一
    normalized = normalized.toLowerCase();
    
    return normalized;
  });
}

/**
 * テキストから検索用のトークンを生成する
 * @param text 元のテキスト
 * @returns 検索用トークンの配列
 */
export function getSearchTokens(text: string): string[] {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  
  // 重複を除去
  return [...new Set(normalized)];
}

/**
 * 複数のテキストからn-gramを生成する（フレーズ検索用）
 * @param tokens トークンの配列
 * @param n n-gramのn
 * @returns n-gramの配列
 */
export function generateNgrams(tokens: string[], n: number = 2): string[] {
  const ngrams: string[] = [];
  
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join('');
    ngrams.push(ngram);
  }
  
  return ngrams;
}

/**
 * DuckDB用のFTSトークナイザー関数を生成する
 * @returns トークナイザー関数の文字列
 */
export function createDuckDBTokenizerFunction(): string {
  // DuckDBのUDF（User Defined Function）として日本語トークナイザーを定義
  // 注: 実際のDuckDBでは、外部関数の直接登録は制限があるため、
  // トークン化はアプリケーション側で行い、結果をDBに保存する方式を採用
  return `
    -- 日本語テキスト用の検索カラムを追加
    ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS search_tokens TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_tokens TEXT;
    ALTER TABLE characters ADD COLUMN IF NOT EXISTS search_tokens TEXT;
    ALTER TABLE plots ADD COLUMN IF NOT EXISTS search_tokens TEXT;
  `;
}

/**
 * テキストの読みやすさスコアを計算する（日本語用）
 * @param text 評価するテキスト
 * @returns 読みやすさスコア（0-100）
 */
export function calculateReadabilityScore(text: string): number {
  const tokens = tokenize(text);
  const totalLength = text.length;
  
  if (totalLength === 0) return 0;
  
  // 平均トークン長
  const avgTokenLength = tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length;
  
  // 句読点の密度
  const punctuationCount = (text.match(/[、。！？]/g) || []).length;
  const punctuationDensity = punctuationCount / tokens.length;
  
  // 漢字の比率
  const kanjiCount = (text.match(/[\u4E00-\u9FAF]/g) || []).length;
  const kanjiRatio = kanjiCount / totalLength;
  
  // スコア計算（簡易版）
  let score = 100;
  
  // トークンが長すぎると読みにくい
  if (avgTokenLength > 4) score -= (avgTokenLength - 4) * 10;
  
  // 句読点が少なすぎても多すぎても読みにくい
  const idealPunctuationDensity = 0.1;
  score -= Math.abs(punctuationDensity - idealPunctuationDensity) * 50;
  
  // 漢字が多すぎると読みにくい
  if (kanjiRatio > 0.4) score -= (kanjiRatio - 0.4) * 50;
  
  return Math.max(0, Math.min(100, score));
}