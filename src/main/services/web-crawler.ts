import { ipcMain, net } from 'electron';
import { URL } from 'url';
import { extractMainContent, generateEmbedding } from './openai-service';
import { v4 as uuidv4 } from 'uuid';
import { getSearchTokens } from './japanese-tokenizer';

interface CrawlOptions {
  maxDepth: number;
  maxPages?: number;
  followExternalLinks?: boolean;
  rateLimit?: number; // ミリ秒
  userAgent?: string;
}

interface CrawlResult {
  url: string;
  title: string;
  content: string;
  summary: string;
  metadata: Record<string, any>;
  links: string[];
  depth: number;
  timestamp: Date;
}

class WebCrawler {
  private visited: Set<string> = new Set();
  private queue: Array<{ url: string; depth: number }> = [];
  private results: CrawlResult[] = [];
  private domain: string = '';
  private options: CrawlOptions;
  private lastRequestTime: number = 0;

  constructor(options: CrawlOptions) {
    this.options = {
      maxDepth: Math.min(options.maxDepth, 5), // 最大5階層
      maxPages: options.maxPages || 100,
      followExternalLinks: options.followExternalLinks || false,
      rateLimit: Math.max(options.rateLimit || 1000, 1000), // 最低1秒
      userAgent: options.userAgent || 'NovelDrive/1.0 (Knowledge Crawler)',
    };
  }

  /**
   * クロールを開始
   */
  async crawl(startUrl: string): Promise<CrawlResult[]> {
    const url = new URL(startUrl);
    this.domain = url.hostname;
    this.queue.push({ url: startUrl, depth: 0 });

    while (this.queue.length > 0 && this.results.length < this.options.maxPages!) {
      const { url, depth } = this.queue.shift()!;

      if (this.visited.has(url) || depth > this.options.maxDepth) {
        continue;
      }

      try {
        await this.rateLimitDelay();
        const result = await this.crawlPage(url, depth);
        if (result) {
          this.results.push(result);
          this.visited.add(url);

          // リンクをキューに追加
          for (const link of result.links) {
            if (this.shouldFollowLink(link)) {
              this.queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
      }
    }

    return this.results;
  }

  /**
   * ページをクロール
   */
  private async crawlPage(url: string, depth: number): Promise<CrawlResult | null> {
    return new Promise((resolve) => {
      const request = net.request({
        url,
        method: 'GET',
        headers: {
          'User-Agent': this.options.userAgent!,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.5',
        },
      });

      let html = '';

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          console.warn(`HTTP ${response.statusCode} for ${url}`);
          resolve(null);
          return;
        }

        const contentType = response.headers['content-type'] as string;
        if (!contentType || !contentType.includes('text/html')) {
          resolve(null);
          return;
        }

        response.on('data', (chunk) => {
          html += chunk.toString();
        });

        response.on('end', async () => {
          try {
            // HTMLからメインコンテンツを抽出
            const extracted = await extractMainContent(html, url);

            // リンクを抽出
            const links = this.extractLinks(html, url);

            resolve({
              url,
              title: extracted.title,
              content: extracted.content,
              summary: extracted.summary,
              metadata: {
                ...extracted.metadata,
                crawledAt: new Date().toISOString(),
                depth,
              },
              links,
              depth,
              timestamp: new Date(),
            });
          } catch (error) {
            console.error('Failed to extract content:', error);
            resolve(null);
          }
        });
      });

      request.on('error', (error) => {
        console.error(`Request error for ${url}:`, error);
        resolve(null);
      });

      request.end();
    });
  }

  /**
   * HTMLからリンクを抽出
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const link = new URL(match[1], baseUrl).href;
        if (link.startsWith('http://') || link.startsWith('https://')) {
          links.push(link);
        }
      } catch {
        // 無効なURLは無視
      }
    }

    return [...new Set(links)]; // 重複除去
  }

  /**
   * リンクをフォローすべきか判定
   */
  private shouldFollowLink(link: string): boolean {
    try {
      const url = new URL(link);

      // 同一ドメインチェック
      if (!this.options.followExternalLinks && url.hostname !== this.domain) {
        return false;
      }

      // 除外パターン
      const excludePatterns = [
        /\.(jpg|jpeg|png|gif|pdf|zip|exe|dmg)$/i,
        /^mailto:/,
        /^javascript:/,
        /#$/,
      ];

      return !excludePatterns.some((pattern) => pattern.test(link));
    } catch {
      return false;
    }
  }

  /**
   * レート制限のための遅延
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.options.rateLimit!) {
      const delay = this.options.rateLimit! - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * クロール結果をナレッジとして保存
 */
async function saveAsKnowledge(
  conn: any,
  results: CrawlResult[],
  projectId?: string
): Promise<{ saved: number; failed: number; skipped: number }> {
  let saved = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of results) {
    try {
      const knowledge = {
        id: uuidv4(),
        title: result.title,
        content: result.content,
        type: 'article',
        projectId,
        sourceUrl: result.url, // URLを直接設定
        metadata: {
          ...result.metadata,
          url: result.url,
          summary: result.summary,
          crawledAt: result.timestamp,
          links: result.links,
        },
      };

      // データベースに直接保存
      const saveResult = await saveKnowledgeFromCrawl(conn, knowledge);

      if (saveResult.success) {
        saved++;
      } else if (saveResult.duplicate) {
        skipped++;
        console.log(`Skipped duplicate URL: ${result.url}`);
      } else {
        failed++;
      }
    } catch (error) {
      console.error('Failed to save knowledge:', error);
      failed++;
    }
  }

  return { saved, failed, skipped };
}

/**
 * クロール結果をデータベースに保存
 */
async function saveKnowledgeFromCrawl(conn: any, knowledge: any): Promise<any> {
  const sourceUrl = knowledge.metadata?.url || knowledge.sourceUrl;

  // URLの重複チェック
  const existingCheck = await new Promise<boolean>((resolve) => {
    conn.all(
      'SELECT id FROM knowledge WHERE source_url = ? LIMIT 1',
      [sourceUrl],
      (err: any, rows: any[]) => {
        if (err) {
          console.error('URL check error:', err);
          resolve(false);
        } else {
          resolve(rows && rows.length > 0);
        }
      }
    );
  });

  if (existingCheck) {
    return {
      success: false,
      error: 'URL already exists in knowledge base',
      duplicate: true,
    };
  }

  // 検索用トークンを生成
  const titleTokens = getSearchTokens(knowledge.title || '');
  const contentTokens = getSearchTokens(knowledge.content || '');
  const searchTokens = [...new Set([...titleTokens, ...contentTokens])].join(' ');

  // ベクトル埋め込みを生成
  let embedding = knowledge.embedding;
  if (!embedding && knowledge.content) {
    try {
      embedding = await generateEmbedding(knowledge.title + ' ' + knowledge.content);
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
    }
  }

  const sql = `
    INSERT INTO knowledge (id, title, content, type, project_id, embedding, metadata, search_tokens, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return new Promise((resolve) => {
    conn.run(
      sql,
      [
        knowledge.id,
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.projectId || null,
        JSON.stringify(embedding || null),
        JSON.stringify(knowledge.metadata || {}),
        searchTokens,
        sourceUrl,
      ],
      (err: any) => {
        if (err) {
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            resolve({
              success: false,
              error: 'URL already exists in knowledge base',
              duplicate: true,
            });
          } else {
            console.error('Knowledge save error:', err);
            resolve({ success: false, error: err.message });
          }
        } else {
          resolve({ success: true });
        }
      }
    );
  });
}

/**
 * IPCハンドラーの設定
 */
export function setupCrawlerHandlers(conn: any): void {
  ipcMain.handle('crawler:crawl', async (_, url: string, depth: number, options?: any) => {
    try {
      const crawler = new WebCrawler({
        maxDepth: depth,
        ...options,
      });

      const results = await crawler.crawl(url);

      // ナレッジとして保存
      const { saved, failed, skipped } = await saveAsKnowledge(conn, results, options?.projectId);

      return {
        success: true,
        crawled: results.length,
        saved,
        failed,
        skipped,
        results: results.map((r) => ({
          url: r.url,
          title: r.title,
          summary: r.summary,
          depth: r.depth,
        })),
      };
    } catch (error) {
      console.error('Crawler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
