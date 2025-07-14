// diffWorker.js - Web Worker for diff calculations

/**
 * 正規化されたテキストで検索を行い、元のテキストでの位置を返す
 */
function normalizeWhitespace(text) {
  return text
    .replace(/\s+/g, ' ') // 連続する空白を1つに
    .replace(/\r\n/g, '\n') // 改行コードを統一
    .replace(/\n+/g, '\n') // 連続する改行を1つに
    .trim();
}

/**
 * レーベンシュタイン距離を計算
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // 削除
          dp[i][j - 1] + 1,    // 挿入
          dp[i - 1][j - 1] + 1 // 置換
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * 類似度スコアを計算（0-1の範囲）
 */
function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * テキスト内で最も類似した部分を探す
 */
function findBestMatch(haystack, needle, threshold = 0.8) {
  // まず完全一致を試す
  const exactIndex = haystack.indexOf(needle);
  if (exactIndex !== -1) {
    return {
      index: exactIndex,
      similarity: 1.0,
      matchedText: needle
    };
  }

  // 正規化して検索
  const normalizedNeedle = normalizeWhitespace(needle);
  const normalizedHaystack = normalizeWhitespace(haystack);
  
  // 正規化されたテキストで完全一致を試す
  const normalizedIndex = normalizedHaystack.indexOf(normalizedNeedle);
  if (normalizedIndex !== -1) {
    // 元のテキストでの位置を推定
    const originalIndex = findOriginalPosition(haystack, normalizedHaystack, normalizedIndex);
    const matchLength = findOriginalLength(haystack, originalIndex, needle.length);
    return {
      index: originalIndex,
      similarity: 0.95, // 正規化後の一致は少し低いスコア
      matchedText: haystack.substring(originalIndex, originalIndex + matchLength)
    };
  }

  // 部分的な類似度検索
  const needleWords = needle.split(/\s+/).filter(w => w.length > 0);
  if (needleWords.length === 0) return null;

  let bestMatch = null;
  const searchLength = Math.min(needle.length * 2, haystack.length);

  // スライディングウィンドウで検索
  for (let i = 0; i <= haystack.length - needle.length / 2; i++) {
    for (let len = Math.floor(needle.length * 0.8); len <= Math.min(searchLength, haystack.length - i); len++) {
      const candidate = haystack.substring(i, i + len);
      const similarity = calculateSimilarity(normalizeWhitespace(candidate), normalizedNeedle);

      if (similarity >= threshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            index: i,
            similarity: similarity,
            matchedText: candidate
          };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * 正規化されたテキストでの位置から元のテキストでの位置を見つける
 */
function findOriginalPosition(original, _normalized, normalizedPos) {
  let originalPos = 0;
  let normalizedCount = 0;

  for (let i = 0; i < original.length; i++) {
    if (normalizedCount >= normalizedPos) {
      return originalPos;
    }

    const char = original[i];
    const normalizedChar = normalizeWhitespace(char);
    
    if (normalizedChar.length > 0) {
      normalizedCount++;
    }
    originalPos++;
  }

  return originalPos;
}

/**
 * 元のテキストで必要な長さを計算
 */
function findOriginalLength(original, startPos, targetLength) {
  let length = 0;
  let count = 0;

  for (let i = startPos; i < original.length && count < targetLength; i++) {
    length++;
    if (!/\s/.test(original[i])) {
      count++;
    }
  }

  return length;
}

/**
 * 複数のdiffを安全に適用
 */
function applyDiffs(content, diffs, threshold = 0.8) {
  let updatedContent = content;
  const results = [];

  // diffを位置の降順でソート（後ろから適用することで位置がずれない）
  const diffsWithIndex = diffs.map(diff => {
    const match = findBestMatch(updatedContent, diff.oldText, threshold);
    return { ...diff, match };
  }).sort((a, b) => (b.match?.index || 0) - (a.match?.index || 0));

  for (const diffWithMatch of diffsWithIndex) {
    const { oldText, newText, match } = diffWithMatch;

    if (match && match.similarity >= threshold) {
      // 置換を実行
      updatedContent = 
        updatedContent.substring(0, match.index) +
        newText +
        updatedContent.substring(match.index + match.matchedText.length);

      results.push({
        oldText,
        newText,
        applied: true,
        index: match.index,
        similarity: match.similarity,
        matchedText: match.matchedText
      });
    } else {
      results.push({
        oldText,
        newText,
        applied: false,
        error: `類似するテキストが見つかりませんでした（閾値: ${threshold}）`
      });
    }
  }

  return {
    content: updatedContent,
    results: results.reverse() // 元の順序に戻す
  };
}

// Web Workerのメッセージハンドラ
self.addEventListener('message', (event) => {
  const { content, diffs, threshold } = event.data;
  
  try {
    // 処理開始をメインスレッドに通知
    self.postMessage({ type: 'progress', message: 'diff計算を開始しました...' });
    
    // diff計算を実行
    const result = applyDiffs(content, diffs, threshold);
    
    // 結果を返す
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    // エラーを返す
    self.postMessage({ type: 'error', error: error.message });
  }
});