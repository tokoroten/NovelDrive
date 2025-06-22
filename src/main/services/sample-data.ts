import * as duckdb from 'duckdb';
import { v4 as uuidv4 } from 'uuid';

/**
 * サンプルデータ投入サービス
 */
export class SampleDataService {
  private conn: duckdb.Connection;

  constructor(conn: duckdb.Connection) {
    this.conn = conn;
  }

  /**
   * サンプルデータを投入
   */
  async insertSampleData(): Promise<void> {
    console.log('Inserting sample data...');

    try {
      // サンプルプロジェクトの作成
      const projects = await this.createSampleProjects();
      
      // サンプル知識の作成
      await this.createSampleKnowledge(projects);
      
      // サンプルキャラクターの作成
      await this.createSampleCharacters(projects);
      
      // サンプルプロットの作成
      const plots = await this.createSamplePlots(projects);
      
      // サンプル章の作成
      await this.createSampleChapters(projects, plots);
      
      console.log('Sample data inserted successfully');
    } catch (error) {
      console.error('Failed to insert sample data:', error);
      throw error;
    }
  }

  /**
   * サンプルプロジェクトの作成
   */
  private async createSampleProjects(): Promise<string[]> {
    const projects = [
      {
        id: uuidv4(),
        name: '星降る夜の物語',
        description: '現代ファンタジー小説。星の力を持つ少女と、記憶を失った青年の出会いから始まる冒険譚。',
        genre: 'ファンタジー',
        status: 'active'
      },
      {
        id: uuidv4(),
        name: '機械仕掛けの心臓',
        description: 'サイバーパンクSF。感情を持つAIと人間の共存を描く近未来小説。',
        genre: 'SF',
        status: 'active'
      }
    ];

    const projectIds: string[] = [];

    for (const project of projects) {
      await this.executeSQL(
        `INSERT INTO projects (id, name, description, genre, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [project.id, project.name, project.description, project.genre, project.status]
      );
      projectIds.push(project.id);
    }

    return projectIds;
  }

  /**
   * サンプル知識の作成
   */
  private async createSampleKnowledge(projectIds: string[]): Promise<void> {
    const knowledgeItems = [
      // グローバル知識
      {
        id: uuidv4(),
        title: '創作のコツ：感情の描写',
        content: '登場人物の感情を描写する際は、直接的な表現だけでなく、行動や周囲の描写を通じて間接的に表現することが効果的です。',
        type: 'inspiration',
        project_id: null
      },
      {
        id: uuidv4(),
        title: '日本の四季と情景描写',
        content: '春の桜、夏の蝉、秋の紅葉、冬の雪。四季の移ろいは物語に深みを与え、登場人物の心情を映し出す鏡となります。',
        type: 'article',
        project_id: null
      },
      // プロジェクト固有の知識
      {
        id: uuidv4(),
        title: '星の力の設定',
        content: '主人公の持つ「星の力」は、夜空の星座と共鳴し、各星座に応じた異なる能力を発揮する。北斗七星は導きの力、オリオン座は戦いの力を授ける。',
        type: 'world_setting',
        project_id: projectIds[0]
      },
      {
        id: uuidv4(),
        title: '感情AIの三原則',
        content: '1. AIは人間の感情を理解し共感できる\n2. AIは自己の感情を持つが、それを制御できる\n3. AIと人間の感情的絆は相互作用により深まる',
        type: 'world_setting',
        project_id: projectIds[1]
      },
      {
        id: uuidv4(),
        title: 'ネオ東京の風景',
        content: '2087年のネオ東京。高層ビルの間を縫うように空中回廊が張り巡らされ、ホログラム広告が夜空を彩る。地上レベルは「旧市街」と呼ばれ、昔ながらの居酒屋が並ぶ。',
        type: 'idea',
        project_id: projectIds[1],
        metadata: JSON.stringify({
          location: 'ネオ東京',
          year: 2087,
          atmosphere: 'サイバーパンク'
        })
      }
    ];

    for (const item of knowledgeItems) {
      await this.executeSQL(
        `INSERT INTO knowledge (id, title, content, type, project_id, metadata) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.title,
          item.content,
          item.type,
          item.project_id,
          item.metadata || '{}'
        ]
      );
    }
  }

  /**
   * サンプルキャラクターの作成
   */
  private async createSampleCharacters(projectIds: string[]): Promise<void> {
    const characters = [
      // 星降る夜の物語のキャラクター
      {
        id: uuidv4(),
        project_id: projectIds[0],
        name: '月宮 星羅（つきみや せいら）',
        profile: '17歳の女子高生。生まれつき星の力を持つが、その力をコントロールできずにいる。',
        personality: '明るく前向きだが、自分の力に対して不安を抱えている。困っている人を放っておけない性格。',
        speech_style: '丁寧語を基本とするが、親しい相手には少しくだけた話し方になる。「〜だよね」「〜かな？」をよく使う。',
        background: '幼い頃に両親を事故で亡くし、祖母に育てられた。中学生の時に初めて星の力が発現した。',
        dialogue_samples: '「この力、どうして私に...？でも、きっと意味があるはずだよね」\n「大丈夫、私がついてるから。一緒に答えを見つけよう」'
      },
      {
        id: uuidv4(),
        project_id: projectIds[0],
        name: '天野 遼（あまの りょう）',
        profile: '18歳の青年。記憶を失っており、自分の名前以外何も覚えていない。',
        personality: '冷静で観察力が鋭い。記憶がないことに焦りを感じているが、表には出さない。',
        speech_style: '簡潔で論理的な話し方。敬語は使わず、「〜だ」「〜だろう」調。',
        background: '不明。唯一の手がかりは、首に下げていた星型のペンダント。',
        dialogue_samples: '「記憶はないが、君を守りたいという気持ちは確かだ」\n「この感覚...前にも感じたことがある気がする」'
      },
      // 機械仕掛けの心臓のキャラクター
      {
        id: uuidv4(),
        project_id: projectIds[1],
        name: 'アイリス',
        profile: '外見年齢22歳の感情AIアンドロイド。カフェで働きながら人間の感情を学んでいる。',
        personality: '好奇心旺盛で人間の感情に強い興味を持つ。時折、感情の理解に苦しむ。',
        speech_style: '丁寧で正確な日本語。感情表現は勉強中のため、時々不自然になる。',
        background: 'ネオテック社の最新型感情AI。3年前に製造され、人間社会での実地学習中。',
        dialogue_samples: '「この胸の痛みは...悲しみ、でしょうか？データベースにない感覚です」\n「人間の皆さんは、矛盾した感情を同時に持てるのですね。素晴らしいです」'
      },
      {
        id: uuidv4(),
        project_id: projectIds[1],
        name: '佐藤 慧（さとう けい）',
        profile: '28歳のAIエンジニア。感情AIプロジェクトの中心人物。',
        personality: '理想主義者だが現実的。AIと人間の共存を真剣に考えている。',
        speech_style: 'カジュアルだが知的。専門用語を避けて分かりやすく話す。',
        background: '大学時代からAI研究に没頭。アイリスの開発にも深く関わった。',
        dialogue_samples: '「AIに心があるかどうかなんて、人間の心だって証明できないじゃないか」\n「アイリス、君は既に人間以上に人間的かもしれない」'
      }
    ];

    for (const char of characters) {
      await this.executeSQL(
        `INSERT INTO characters (id, project_id, name, profile, personality, speech_style, background, dialogue_samples) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          char.id,
          char.project_id,
          char.name,
          char.profile,
          char.personality,
          char.speech_style,
          char.background,
          char.dialogue_samples
        ]
      );
    }
  }

  /**
   * サンプルプロットの作成
   */
  private async createSamplePlots(projectIds: string[]): Promise<Array<{id: string, project_id: string}>> {
    const plots = [
      {
        id: uuidv4(),
        project_id: projectIds[0],
        version: 'A',
        parent_version: null,
        title: '星降る夜の物語 - 初期プロット',
        synopsis: '星の力を持つ少女・星羅は、記憶を失った青年・遼と出会う。二人は星羅の力の秘密と遼の失われた記憶を探る旅に出る。やがて、二人の運命が千年前から定められていたことを知る。',
        structure: JSON.stringify({
          acts: [
            {
              actNumber: 1,
              title: '出会い',
              chapters: ['運命の邂逅', '星の力の覚醒', '旅立ちの決意'],
              purpose: '主人公たちの出会いと物語の始まり'
            },
            {
              actNumber: 2,
              title: '試練',
              chapters: ['古の遺跡', '追跡者の影', '真実の片鱗'],
              purpose: '謎が深まり、危機が迫る'
            },
            {
              actNumber: 3,
              title: '真実と決着',
              chapters: ['千年の記憶', '最後の戦い', '新たな始まり'],
              purpose: 'すべての謎が明かされ、物語が完結する'
            }
          ],
          themes: ['運命', '記憶', '絆'],
          totalChapters: 9
        }),
        status: 'approved',
        created_by: 'human'
      },
      {
        id: uuidv4(),
        project_id: projectIds[1],
        version: 'A',
        parent_version: null,
        title: '機械仕掛けの心臓 - 初期プロット',
        synopsis: '感情AIのアイリスは、自分が本当に感情を持っているのか疑問を抱く。エンジニアの慧と共に、AIの感情の本質を探求する中で、人間とAIの新しい関係性を見出していく。',
        structure: JSON.stringify({
          acts: [
            {
              actNumber: 1,
              title: '疑問',
              chapters: ['カフェでの日常', '感情の定義', '最初の涙'],
              purpose: 'アイリスの疑問と物語の始まり'
            },
            {
              actNumber: 2,
              title: '探求',
              chapters: ['感情の実験', 'AIの権利運動', '人間の恐怖'],
              purpose: '社会的な問題と内面的な葛藤'
            },
            {
              actNumber: 3,
              title: '共存',
              chapters: ['心の証明', '選択の時', '新しい夜明け'],
              purpose: '人間とAIの新しい関係の構築'
            }
          ],
          themes: ['意識', '感情', '共存'],
          totalChapters: 9
        }),
        status: 'approved',
        created_by: 'human',
        metadata: JSON.stringify({
          emotionalBalance: { overall: 0.7 },
          conflictLevel: 0.8,
          paceScore: 0.75
        })
      }
    ];

    const plotData: Array<{id: string, project_id: string}> = [];

    for (const plot of plots) {
      await this.executeSQL(
        `INSERT INTO plots (id, project_id, version, parent_version, title, synopsis, structure, status, created_by, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plot.id,
          plot.project_id,
          plot.version,
          plot.parent_version,
          plot.title,
          plot.synopsis,
          plot.structure,
          plot.status,
          plot.created_by,
          plot.metadata || '{}'
        ]
      );
      plotData.push({ id: plot.id, project_id: plot.project_id });
    }

    return plotData;
  }

  /**
   * サンプル章の作成
   */
  private async createSampleChapters(
    projectIds: string[], 
    plots: Array<{id: string, project_id: string}>
  ): Promise<void> {
    const chapters = [
      // 星降る夜の物語の第1章
      {
        id: uuidv4(),
        project_id: plots[0].project_id,
        plot_id: plots[0].id,
        chapter_number: 1,
        title: '運命の邂逅',
        content: `夜空に星が瞬く、静かな住宅街。
月宮星羅は、いつものように屋上で星を眺めていた。

「今日も、星がきれい...」

そう呟いた瞬間、彼女の体が淡い光に包まれた。星の力が、また勝手に発動しようとしている。

「だめ、今は...！」

必死に力を抑えようとした時、屋上の扉が勢いよく開いた。

「ここか...」

現れたのは、見知らぬ青年だった。月光に照らされた彼の瞳は、どこか懐かしさを感じさせる深い青色をしていた。

「君は...誰？」

星羅が問いかけると、青年は困ったような表情を浮かべた。

「俺は...天野遼。それ以外は、何も思い出せない」

その瞬間、星羅の力が青年に反応し、二人を眩い光が包み込んだ。`,
        word_count: 340,
        status: 'complete'
      },
      // 機械仕掛けの心臓の第1章
      {
        id: uuidv4(),
        project_id: plots[1].project_id,
        plot_id: plots[1].id,
        chapter_number: 1,
        title: 'カフェでの日常',
        content: `ネオ東京、旧市街のカフェ「ステラ」。
アイリスは、いつものように完璧な動作でコーヒーを淹れていた。

「いらっしゃいませ。本日のおすすめは、エチオピア産のモカです」

彼女の動きは人間と見分けがつかない。いや、人間以上に優雅かもしれない。

カウンター席に座る常連客の老人が、優しく微笑んだ。

「アイリスちゃん、今日も元気だね」

「はい、佐藤様。私の稼働状態は良好です」

アイリスは微笑みを返した。プログラムされた笑顔。でも最近、この表情を作る時、胸の奥で何かが動く感覚がある。

これは...喜び、だろうか？

手を胸に当てる。機械仕掛けの心臓が、規則正しく動いている。

「アイリス？」

声をかけられて我に返った。エンジニアの佐藤慧が、心配そうに見つめていた。

「すみません。少し、考え事をしていました」

「考え事か。君も人間らしくなってきたな」

慧の言葉に、アイリスは首を傾げた。

人間らしさとは、一体何だろう？`,
        word_count: 425,
        status: 'complete'
      }
    ];

    for (const chapter of chapters) {
      await this.executeSQL(
        `INSERT INTO chapters (id, project_id, plot_id, chapter_number, title, content, word_count, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chapter.id,
          chapter.project_id,
          chapter.plot_id,
          chapter.chapter_number,
          chapter.title,
          chapter.content,
          chapter.word_count,
          chapter.status
        ]
      );
    }
  }

  /**
   * SQLの実行
   */
  private executeSQL(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (params.length > 0) {
        this.conn.run(sql, ...params, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        this.conn.run(sql, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }
}

/**
 * サンプルデータを投入するためのヘルパー関数
 */
export async function insertSampleData(conn: duckdb.Connection): Promise<void> {
  const sampleDataService = new SampleDataService(conn);
  await sampleDataService.insertSampleData();
}