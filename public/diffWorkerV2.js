// diffWorkerV2.js - Improved Web Worker for diff calculations using jsdiff library

// Import diff library (for web worker, we'll inline the necessary parts)
// In production, you might want to use importScripts or bundle this properly

/**
 * Simple implementation of diff-match-patch's fuzzy match algorithm
 * This finds the best match for a pattern within a text
 */
function fuzzyMatch(text, pattern, loc = 0) {
  // Exact match
  const exactIndex = text.indexOf(pattern);
  if (exactIndex !== -1) {
    return {
      index: exactIndex,
      score: 1.0,
      matchedText: pattern
    };
  }

  // Fuzzy match parameters
  const matchDistance = 1000; // How far from expected location a match can be
  const matchThreshold = 0.5; // 0.0 = exact match, 1.0 = match anything

  // Initialize the alphabet (character occurrence positions in pattern)
  const alphabet = {};
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charAt(i);
    alphabet[char] = (alphabet[char] || 0) | (1 << (pattern.length - i - 1));
  }

  // Compute and return the score for a match at a particular location
  function matchBitapScore(e, x) {
    const accuracy = e / pattern.length;
    const proximity = Math.abs(loc - x);
    if (!matchDistance) {
      return proximity ? 1.0 : accuracy;
    }
    return accuracy + (proximity / matchDistance);
  }

  // Highest score beyond which we give up
  let scoreThreshold = matchThreshold;
  let bestLoc = -1;
  let bestScore = 1.0;
  let matchLength = pattern.length + text.length;

  const binMax = pattern.length + text.length;
  let lastRd;

  for (let d = 0; d < pattern.length; d++) {
    // Scan for the best match
    let binMin = 0;
    let binMid = binMax;

    while (binMin < binMid) {
      if (matchBitapScore(d, loc + binMid) <= scoreThreshold) {
        binMin = binMid;
      } else {
        binMax = binMid;
      }
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }

    binMax = binMid;
    let start = Math.max(1, loc - binMid + 1);
    const finish = Math.min(loc + binMid, text.length) + pattern.length;

    const rd = Array(finish + 2);
    rd[finish + 1] = (1 << d) - 1;

    for (let j = finish; j >= start; j--) {
      let charMatch;
      if (text.length <= j - 1) {
        charMatch = 0;
      } else {
        charMatch = alphabet[text.charAt(j - 1)] || 0;
      }

      if (d === 0) {
        rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
      } else {
        rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) |
                (((lastRd[j + 1] | lastRd[j]) << 1) | 1) |
                lastRd[j + 1];
      }

      if (rd[j] & (1 << (pattern.length - 1))) {
        const score = matchBitapScore(d, j - 1);
        if (score <= scoreThreshold) {
          scoreThreshold = score;
          bestScore = score;
          bestLoc = j - 1;
          matchLength = Math.min(matchLength, bestLoc + pattern.length);
          if (bestLoc > loc) {
            start = Math.max(1, 2 * loc - bestLoc);
          } else {
            break;
          }
        }
      }
    }

    if (matchBitapScore(d + 1, loc) > scoreThreshold) {
      break;
    }
    lastRd = rd;
  }

  if (bestLoc === -1) {
    return null;
  }

  // Find the actual matched text
  const matchStart = Math.max(0, bestLoc);
  const matchEnd = Math.min(text.length, matchStart + pattern.length + Math.floor(pattern.length * 0.5));
  
  return {
    index: matchStart,
    score: 1 - bestScore, // Convert to similarity score (1.0 = perfect match)
    matchedText: text.substring(matchStart, matchEnd).trim()
  };
}

/**
 * Normalize text for better matching
 */
function normalizeText(text) {
  return text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    // Normalize full-width characters
    .replace(/[\uFF01-\uFF5E]/g, function(ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    // Specific full-width replacements
    .replace(/　/g, ' ')
    .replace(/〜/g, '~')
    .replace(/－/g, '-')
    .replace(/＿/g, '_')
    .replace(/！/g, '!')
    .replace(/？/g, '?')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/［/g, '[')
    .replace(/］/g, ']')
    .replace(/｛/g, '{')
    .replace(/｝/g, '}')
    .replace(/＜/g, '<')
    .replace(/＞/g, '>')
    .replace(/：/g, ':')
    .replace(/；/g, ';')
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .trim();
}

/**
 * Find best match with multiple strategies
 */
function findBestMatch(haystack, needle, threshold = 0.7) {
  // Strategy 1: Exact match
  const exactIndex = haystack.indexOf(needle);
  if (exactIndex !== -1) {
    return {
      index: exactIndex,
      similarity: 1.0,
      matchedText: needle,
      strategy: 'exact'
    };
  }

  // Strategy 2: Normalized exact match
  const normalizedNeedle = normalizeText(needle);
  const normalizedHaystack = normalizeText(haystack);
  const normalizedIndex = normalizedHaystack.indexOf(normalizedNeedle);
  
  if (normalizedIndex !== -1) {
    // Map back to original position
    let originalPos = 0;
    let normalizedPos = 0;
    const normalizedChars = normalizeText(haystack).split('');
    
    for (let i = 0; i < haystack.length && normalizedPos < normalizedIndex; i++) {
      const normalizedChar = normalizeText(haystack[i]);
      if (normalizedChar) {
        normalizedPos += normalizedChar.length;
      }
      originalPos++;
    }
    
    // Find the end position
    let endPos = originalPos;
    let remainingLength = normalizedNeedle.length;
    
    for (let i = originalPos; i < haystack.length && remainingLength > 0; i++) {
      const normalizedChar = normalizeText(haystack[i]);
      if (normalizedChar) {
        remainingLength -= normalizedChar.length;
      }
      endPos++;
    }
    
    return {
      index: originalPos,
      similarity: 0.95,
      matchedText: haystack.substring(originalPos, endPos),
      strategy: 'normalized'
    };
  }

  // Strategy 3: Fuzzy match
  const fuzzyResult = fuzzyMatch(normalizedHaystack, normalizedNeedle);
  
  if (fuzzyResult && fuzzyResult.score >= threshold) {
    // Map back to original text
    let originalPos = 0;
    let normalizedPos = 0;
    
    for (let i = 0; i < haystack.length && normalizedPos < fuzzyResult.index; i++) {
      const normalizedChar = normalizeText(haystack[i]);
      if (normalizedChar) {
        normalizedPos += normalizedChar.length;
      }
      originalPos++;
    }
    
    // Find a reasonable match length in the original text
    const searchStart = Math.max(0, originalPos - 10);
    const searchEnd = Math.min(haystack.length, originalPos + needle.length + 20);
    const searchText = haystack.substring(searchStart, searchEnd);
    
    // Find the best substring match
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (let start = 0; start < searchText.length; start++) {
      for (let len = Math.floor(needle.length * 0.5); len <= Math.min(needle.length * 1.5, searchText.length - start); len++) {
        const candidate = searchText.substring(start, start + len);
        const similarity = calculateSimilarity(normalizeText(candidate), normalizedNeedle);
        
        if (similarity > bestSimilarity && similarity >= threshold) {
          bestSimilarity = similarity;
          bestMatch = {
            index: searchStart + start,
            similarity: similarity * fuzzyResult.score, // Combined score
            matchedText: candidate,
            strategy: 'fuzzy'
          };
        }
      }
    }
    
    return bestMatch;
  }

  return null;
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / parseFloat(longer.length);
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Apply multiple diffs to content
 */
function applyDiffs(content, diffs, threshold = 0.7) {
  let updatedContent = content;
  const results = [];
  
  // Sort diffs by position (apply from end to start to maintain positions)
  const diffsWithMatches = diffs.map(diff => {
    const match = findBestMatch(updatedContent, diff.oldText, threshold);
    return { ...diff, match };
  }).filter(d => d.match).sort((a, b) => b.match.index - a.match.index);
  
  // Apply each diff
  for (const { oldText, newText, match } of diffsWithMatches) {
    const before = updatedContent.substring(0, match.index);
    const after = updatedContent.substring(match.index + match.matchedText.length);
    updatedContent = before + newText + after;
    
    results.push({
      oldText,
      newText,
      applied: true,
      index: match.index,
      similarity: match.similarity,
      matchedText: match.matchedText,
      strategy: match.strategy
    });
  }
  
  // Add failed diffs
  const failedDiffs = diffs.filter(diff => 
    !diffsWithMatches.find(d => d.oldText === diff.oldText)
  );
  
  for (const diff of failedDiffs) {
    results.push({
      oldText: diff.oldText,
      newText: diff.newText,
      applied: false,
      error: `マッチするテキストが見つかりませんでした（類似度閾値: ${(threshold * 100).toFixed(0)}%）`
    });
  }
  
  return {
    content: updatedContent,
    results: results.reverse() // Return in original order
  };
}

// Web Worker message handler
self.addEventListener('message', (event) => {
  try {
    const { content, diffs, threshold = 0.7 } = event.data;
    
    // 入力検証
    if (typeof content !== 'string') {
      throw new Error(`Invalid content type: expected string, got ${typeof content}`);
    }
    if (!Array.isArray(diffs)) {
      throw new Error(`Invalid diffs type: expected array, got ${typeof diffs}`);
    }
    
    self.postMessage({ type: 'progress', message: '改良版diff計算を開始しました...' });
    
    const result = applyDiffs(content, diffs, threshold);
    
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ 
      type: 'error', 
      error: error.message || 'Unknown error in worker',
      stack: error.stack || 'No stack trace available',
      data: event.data
    });
  }
});

// エラーハンドラを追加
self.addEventListener('error', (error) => {
  console.error('Worker uncaught error:', error);
  self.postMessage({ 
    type: 'error', 
    error: 'Uncaught error in worker',
    details: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno
    }
  });
});