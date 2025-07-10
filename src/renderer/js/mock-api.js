// Mock API for browser environment (Vite development)
// This file provides mock implementations of Electron IPC calls for UI debugging

class MockAPI {
    constructor() {
        this.mockData = {
            projects: [
                {
                    id: 1,
                    name: "サンプル小説プロジェクト",
                    description: "これはテスト用のプロジェクトです。Viteでの動作確認に使用されます。",
                    created_at: "2024-01-01T00:00:00.000Z",
                    metadata: JSON.stringify({
                        genre: "fantasy",
                        targetLength: 100000,
                        status: "writing"
                    }),
                    knowledge_count: 5,
                    character_count: 3,
                    plot_count: 1,
                    chapter_count: 8
                },
                {
                    id: 2,
                    name: "SF短編集",
                    description: "宇宙を舞台にした短編小説のコレクション",
                    created_at: "2024-01-15T00:00:00.000Z",
                    metadata: JSON.stringify({
                        genre: "scifi",
                        targetLength: 50000,
                        status: "planning"
                    }),
                    knowledge_count: 2,
                    character_count: 1,
                    plot_count: 0,
                    chapter_count: 0
                }
            ],
            plots: [
                {
                    id: 1,
                    title: "魔法学園の秘密",
                    chapters: [
                        { id: 1, title: "入学式", wordCount: 2500, summary: "主人公が魔法学園に入学する" },
                        { id: 2, title: "最初の授業", wordCount: 3200, summary: "魔法の基礎を学ぶ" },
                        { id: 3, title: "友達との出会い", wordCount: 2800, summary: "仲間たちとの絆を深める" }
                    ]
                }
            ],
            settings: {
                api: {
                    openai: {
                        hasApiKey: false,
                        model: "gpt-4",
                        temperature: 0.7,
                        isConfigured: false
                    }
                },
                ai: {
                    writerModerateIgnorance: true,
                    responseLength: "medium",
                    language: "ja",
                    serendipityDistance: 0.5,
                    serendipityNoise: 0.2
                },
                editor: {
                    fontSize: "16",
                    lineHeight: "1.6",
                    showLineNumbers: false,
                    wordWrap: true,
                    autoSave: true,
                    autoSaveInterval: "30",
                    backupCount: 10
                },
                export: {
                    defaultFormat: "txt",
                    includeMetadata: true,
                    includeNotes: false,
                    filenamePattern: "{project}_{date}_{time}"
                },
                advanced: {
                    dataLocation: "/mock/data/path",
                    enable24hMode: false,
                    debugMode: true
                }
            }
        };
    }

    async invoke(channel, data = {}) {
        console.log(`[Mock API] ${channel}`, data);
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
        
        switch (channel) {
            // Project API
            case 'project:getAll':
                return { success: true, data: this.mockData.projects };
            
            case 'project:create':
                const newProject = {
                    id: Date.now(),
                    name: data.name,
                    description: data.description,
                    created_at: new Date().toISOString(),
                    metadata: JSON.stringify(data.metadata),
                    knowledge_count: 0,
                    character_count: 0,
                    plot_count: 0,
                    chapter_count: 0
                };
                this.mockData.projects.push(newProject);
                return { success: true, data: newProject };
            
            case 'project:update':
                const projectIndex = this.mockData.projects.findIndex(p => p.id === data.id);
                if (projectIndex >= 0) {
                    this.mockData.projects[projectIndex] = { ...this.mockData.projects[projectIndex], ...data };
                    return { success: true, data: this.mockData.projects[projectIndex] };
                }
                return { success: false, error: { message: 'Project not found' } };
            
            case 'project:delete':
                const deleteIndex = this.mockData.projects.findIndex(p => p.id === data);
                if (deleteIndex >= 0) {
                    this.mockData.projects.splice(deleteIndex, 1);
                    return true;
                }
                return { success: false, error: { message: 'Project not found' } };
            
            // Plot API
            case 'plot:list':
                const plotsForProject = this.mockData.plots.filter(p => p.projectId === data.projectId || !data.projectId);
                return plotsForProject.map(plot => ({
                    id: plot.id,
                    title: plot.title,
                    version: plot.version || 1,
                    projectId: plot.projectId
                }));
            
            case 'plot:get':
                const plot = this.mockData.plots.find(p => p.id === data.id);
                if (!plot) return null;
                
                // Return comprehensive plot data
                return {
                    id: plot.id,
                    title: plot.title || 'Untitled Plot',
                    premise: plot.premise || 'プロットの前提設定がここに入ります。',
                    projectId: plot.projectId,
                    version: plot.version || 1,
                    structure: plot.structure || {
                        acts: [
                            '第一幕：世界と主人公の紹介、きっかけとなる事件',
                            '第二幕：障害と挑戦、キャラクターの成長と葛藤',
                            '第三幕：クライマックスと解決、新しい日常'
                        ]
                    },
                    chapters: plot.chapters || [
                        {
                            id: 1,
                            title: '第1章 始まりの朝',
                            summary: '主人公が日常から非日常へと踏み出す最初の章',
                            type: 'setup',
                            order: 1
                        },
                        {
                            id: 2,
                            title: '第2章 新たな出会い',
                            summary: '重要なキャラクターとの運命的な出会い',
                            type: 'rising_action',
                            order: 2
                        },
                        {
                            id: 3,
                            title: '第3章 隠された真実',
                            summary: '物語の核心に迫る重要な手がかりの発見',
                            type: 'rising_action',
                            order: 3
                        }
                    ],
                    characterArcs: plot.characterArcs || {
                        '主人公': {
                            start: '普通の学生として平凡な日々を送っている',
                            middle: '困難に直面し自分の本当の力と向き合う',
                            end: '成長を遂げ新しい自分として歩み始める'
                        },
                        'ヒロイン': {
                            start: '謎めいた少女として登場',
                            middle: '主人公との絆を深めながら自分の使命に気づく',
                            end: '真の力を発揮し新しい世界の扉を開く'
                        }
                    },
                    timeline: plot.timeline || [
                        {
                            id: 1,
                            title: '学園祭',
                            date: 'Day 5',
                            description: '年に一度の学園祭で重要な出来事が起こる'
                        },
                        {
                            id: 2,
                            title: '転校生の到着',
                            date: 'Day 10',
                            description: '物語のキーパーソンとなる転校生が現れる'
                        },
                        {
                            id: 3,
                            title: '真実の発覚',
                            date: 'Day 20',
                            description: '隠されていた重要な事実が明らかになる'
                        }
                    ],
                    themes: plot.themes || ['成長', '友情', '自分らしさ', '運命'],
                    conflicts: plot.conflicts || [
                        {
                            id: 1,
                            title: '内なる迷い',
                            description: '主人公が自分の進むべき道について悩む内的葛藤',
                            resolved: false,
                            resolution: null
                        },
                        {
                            id: 2,
                            title: '友人との対立',
                            description: '価値観の違いから生じる親友との衝突',
                            resolved: false,
                            resolution: null
                        },
                        {
                            id: 3,
                            title: '過去の影',
                            description: '主人公の過去が現在に影響を与える問題',
                            resolved: true,
                            resolution: '過去と向き合い受け入れることで解決'
                        }
                    ],
                    versions: plot.versions || [],
                    createdAt: plot.createdAt || new Date().toISOString(),
                    updatedAt: plot.updatedAt || new Date().toISOString()
                };
            
            case 'plot:create':
                const newPlot = {
                    id: Date.now(),
                    title: data.title,
                    premise: data.premise || '',
                    projectId: data.projectId,
                    version: 1,
                    structure: data.structure || { acts: ['', '', ''] },
                    chapters: [],
                    characterArcs: {},
                    timeline: [],
                    themes: [],
                    conflicts: [],
                    versions: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                this.mockData.plots.push(newPlot);
                return newPlot;
            
            case 'plot:update':
                const plotIndex = this.mockData.plots.findIndex(p => p.id === data.id);
                if (plotIndex >= 0) {
                    this.mockData.plots[plotIndex] = {
                        ...this.mockData.plots[plotIndex],
                        ...data.data,
                        updatedAt: new Date().toISOString()
                    };
                    return this.mockData.plots[plotIndex];
                }
                return null;
            
            case 'plot:saveVersion':
                const plotForVersion = this.mockData.plots.find(p => p.id === data.id);
                if (plotForVersion) {
                    const newVersion = {
                        version: (plotForVersion.version || 1) + 1,
                        data: data.versionData,
                        archivedAt: new Date().toISOString(),
                        changes: data.versionData.changes || []
                    };
                    
                    if (!plotForVersion.versions) plotForVersion.versions = [];
                    plotForVersion.versions.push(newVersion);
                    plotForVersion.version = newVersion.version;
                    
                    return plotForVersion;
                }
                return null;
            
            case 'plot:addChapter':
                const plotForChapter = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForChapter) {
                    const newChapter = {
                        id: Date.now(),
                        title: data.data.title,
                        summary: data.data.summary,
                        type: data.data.type,
                        order: (plotForChapter.chapters?.length || 0) + 1
                    };
                    
                    if (!plotForChapter.chapters) plotForChapter.chapters = [];
                    plotForChapter.chapters.push(newChapter);
                    
                    return newChapter;
                }
                return null;
            
            case 'plot:updateChapter':
                const plotForChapterUpdate = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForChapterUpdate && plotForChapterUpdate.chapters) {
                    const chapterIndex = plotForChapterUpdate.chapters.findIndex(ch => ch.id === data.chapterId);
                    if (chapterIndex >= 0) {
                        plotForChapterUpdate.chapters[chapterIndex] = {
                            ...plotForChapterUpdate.chapters[chapterIndex],
                            ...data.data
                        };
                        return plotForChapterUpdate.chapters[chapterIndex];
                    }
                }
                return null;
            
            case 'plot:reorderChapters':
                const plotForReorder = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForReorder && plotForReorder.chapters) {
                    const newOrder = data.chapterOrder;
                    const reorderedChapters = newOrder.map(id => 
                        plotForReorder.chapters.find(ch => ch.id === id)
                    ).filter(Boolean);
                    
                    plotForReorder.chapters = reorderedChapters.map((ch, index) => ({
                        ...ch,
                        order: index + 1
                    }));
                    
                    return { success: true };
                }
                return { success: false };
            
            case 'plot:updateCharacterArc':
                const plotForArc = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForArc) {
                    if (!plotForArc.characterArcs) plotForArc.characterArcs = {};
                    plotForArc.characterArcs[data.characterName] = data.arcData;
                    return { success: true };
                }
                return { success: false };
            
            case 'plot:addTimelineEvent':
                const plotForTimeline = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForTimeline) {
                    const newEvent = {
                        id: Date.now(),
                        ...data.event
                    };
                    
                    if (!plotForTimeline.timeline) plotForTimeline.timeline = [];
                    plotForTimeline.timeline.push(newEvent);
                    
                    return newEvent;
                }
                return null;
            
            case 'plot:updateThemes':
                const plotForThemes = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForThemes) {
                    plotForThemes.themes = data.themes;
                    return { success: true };
                }
                return { success: false };
            
            case 'plot:addConflict':
                const plotForConflict = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForConflict) {
                    const newConflict = {
                        id: Date.now(),
                        title: data.conflict.title,
                        description: data.conflict.description,
                        resolved: false,
                        resolution: null
                    };
                    
                    if (!plotForConflict.conflicts) plotForConflict.conflicts = [];
                    plotForConflict.conflicts.push(newConflict);
                    
                    return newConflict;
                }
                return null;
            
            case 'plot:resolveConflict':
                const plotForResolution = this.mockData.plots.find(p => p.id === data.plotId);
                if (plotForResolution && plotForResolution.conflicts) {
                    const conflictIndex = plotForResolution.conflicts.findIndex(c => c.id === data.conflictId);
                    if (conflictIndex >= 0) {
                        plotForResolution.conflicts[conflictIndex].resolved = true;
                        plotForResolution.conflicts[conflictIndex].resolution = data.resolution;
                        return { success: true };
                    }
                }
                return { success: false };
            
            case 'plot:analyze':
                // Simulate plot analysis
                const plotForAnalysis = this.mockData.plots.find(p => p.id === data.id);
                if (!plotForAnalysis) return null;
                
                const analysis = {
                    completeness: {
                        score: Math.floor(Math.random() * 30) + 70, // 70-100%
                        details: 'プロットの基本構造は整っています'
                    },
                    pacing: {
                        score: Math.floor(Math.random() * 25) + 65, // 65-90%
                        details: 'ペーシングはおおむね良好です'
                    },
                    characterDevelopment: {
                        score: Math.floor(Math.random() * 35) + 60, // 60-95%
                        details: 'キャラクターの成長が見込まれます'
                    },
                    suggestions: [
                        {
                            priority: 'high',
                            message: 'クライマックスの盛り上がりをより強化することをお勧めします'
                        },
                        {
                            priority: 'medium',
                            message: 'サブキャラクターの動機をより明確にできます'
                        },
                        {
                            priority: 'low',
                            message: '設定の詳細を追加することで世界観が豊かになります'
                        }
                    ]
                };
                
                return analysis;
            
            case 'character:list':
                // Mock character list for plot management
                const characters = this.mockData.knowledge?.filter(k => 
                    k.projectId === data.projectId && k.category === 'character'
                ) || [];
                
                return characters.map(char => ({
                    id: char.id,
                    name: char.title,
                    description: char.content
                }));
            
            // Chapter API
            case 'chapter:getContent':
                return `これは章 ${data.chapterId} のサンプルコンテンツです。\n\nViteでの動作確認のために作成されたモックデータです。\n\n実際のアプリケーションでは、ここに執筆された内容が表示されます。`;
            
            case 'chapter:saveContent':
                console.log(`[Mock] Saving chapter ${data.chapterId}:`, data.content.substring(0, 50) + '...');
                return { success: true };
            
            case 'chapter:getNotes':
                return `章 ${data.chapterId} のメモです。`;
            
            case 'chapter:saveNotes':
                console.log(`[Mock] Saving notes for chapter ${data.chapterId}:`, data.notes);
                return { success: true };
            
            // Thread API
            case 'thread:save':
                // スレッドデータを保存（Mock実装）
                console.log('[Mock API] Saving thread data:', data);
                localStorage.setItem('ai-thread-manager', JSON.stringify(data));
                return { success: true };
            
            case 'thread:load':
                // スレッドデータを読み込み（Mock実装）
                const savedThreads = localStorage.getItem('ai-thread-manager');
                if (savedThreads) {
                    return JSON.parse(savedThreads);
                }
                return { version: '1.0', threads: [], lastSaved: new Date() };
            
            // Settings API
            case 'settings:get':
                return this.mockData.settings;
            
            case 'settings:save':
                this.mockData.settings = { ...this.mockData.settings, ...data };
                return { success: true };
            
            case 'settings:reset':
                // Reset to defaults
                return { success: true };
            
            // OpenAI API
            case 'openai:getConfig':
                return this.mockData.settings.api.openai;
            
            case 'openai:setApiKey':
                this.mockData.settings.api.openai.hasApiKey = true;
                this.mockData.settings.api.openai.isConfigured = true;
                return { success: true };
            
            case 'openai:updateSettings':
                Object.assign(this.mockData.settings.api.openai, data);
                return { success: true };
            
            case 'openai:testConnection':
                // Simulate API test
                if (!this.mockData.settings.api.openai.isConfigured && !data.apiKey) {
                    throw new Error('APIキーが設定されていません');
                }
                
                // Simulate different test results
                const random = Math.random();
                if (random < 0.8) {
                    // Success
                    return {
                        success: true,
                        model: data.model || 'gpt-4',
                        responseTime: Math.floor(800 + Math.random() * 1200),
                        testMessage: 'こんにちは、NovelDriveです！',
                        tokensUsed: 15,
                        modelInfo: 'GPT-4 (Mock)'
                    };
                } else {
                    // Error
                    return {
                        success: false,
                        error: 'Mock API: ランダムエラーが発生しました（テスト用）'
                    };
                }
            
            case 'openai:assistWriting':
                // Mock AI writing assistance
                const writingResponses = {
                    continue: '物語は続いていく。主人公は新たな冒険に向かって歩み始めた。',
                    improve: 'より洗練された表現に改善されたテキストがここに表示されます。',
                    expand: '詳細な描写と豊かな表現が追加されたバージョンがここに表示されます。',
                    dialogue: '「それは素晴らしいアイデアですね」と彼女は微笑みながら答えた。',
                    scene: '夕日が地平線に沈む中、静寂に包まれた森に風が優しく吹き抜けていた。',
                    brainstorm: '新しい展開のアイデア：謎の手紙、失われた記憶、隠された真実'
                };
                
                return {
                    text: writingResponses[data.action] || 'AIからの提案がここに表示されます。'
                };
            
            case 'openai:assistWritingEnhanced':
                // Enhanced AI writing assistance with personality and memory
                const enhancedResponses = {
                    writer_sharp: {
                        continue: '街角で待つ彼女の姿を見つけた瞬間、時間が止まった。',
                        improve: '彼は振り返る。一瞬の躊躇。そして――決断した。',
                        expand: '雨音が窓を叩く。彼女の指先が震えている。言葉にならない想いが、二人の間に漂っていた。',
                        dialogue: '「もう限界だ」\n彼の声が、夜の静寂を切り裂いた。',
                        scene: '街灯が作る影の中、彼の足音だけが響いている。',
                        brainstorm: '衝撃的な展開：裏切りの真実、隠されたアイデンティティ、最後の選択'
                    },
                    writer_emotional: {
                        continue: '涙が頬を伝った。でも、それは悲しみではなく——希望の涙だった。',
                        improve: '彼女の心の奥底で、忘れていた記憶が静かに蘇ってきた。温かく、切なく、愛おしい記憶が。',
                        expand: '母の手の温もりを思い出す。あの日、別れ際に交わした約束。今なら理解できる、あの時の母の気持ちが。',
                        dialogue: '「ありがとう」\n小さな声だったけれど、彼女の心からの言葉だった。',
                        scene: '桜の花びらが舞い散る中、二人はただ静かに歩いていた。',
                        brainstorm: '感動的な展開：家族の絆、友情の深さ、愛の真実'
                    },
                    writer_descriptive: {
                        continue: '古い石畳の道は、雨に濡れて鈍く光っていた。街角の向こうから聞こえる足音が、彼の心臓の鼓動と重なる。',
                        improve: '彼女の髪は風にゆれ、夕日に照らされて金色に輝いていた。その美しさは、まるで絵画から抜け出した天使のようだった。',
                        expand: '古い図書館の奥で、埃っぽい本の匂いに包まれながら、彼女は運命的な一冊と出会った。革装丁の表紙は時を経て深い茶色に変わり、金の文字は所々剥げて読めないほどだった。',
                        dialogue: '「この景色、まるで夢みたい」\n彼女の声は、山間に響く鐘の音のように澄んでいた。',
                        scene: '霧に包まれた古城の尖塔が、月明かりの中に幻想的なシルエットを描いている。',
                        brainstorm: '美しい展開：幻想的な世界、神秘的な出会い、自然の驚異'
                    }
                };
                
                const agentId = data.agentId || 'writer_sharp';
                const agentResponses = enhancedResponses[agentId] || enhancedResponses['writer_sharp'];
                const baseResponse = agentResponses[data.action] || agentResponses['continue'];
                
                // Add personality-based modifications
                const personality = data.personality || {};
                let finalResponse = baseResponse;
                
                // Apply style modifications based on personality traits
                if (personality.traits) {
                    const traits = personality.traits;
                    
                    // Higher creativity adds more unique elements
                    if (traits.creativity >= 80) {
                        finalResponse += '\n\n（創造性強化版）';
                    }
                    
                    // Higher emotion adds more feeling
                    if (traits.emotion >= 80 && data.action !== 'dialogue') {
                        finalResponse = finalResponse.replace(/。/g, '。心が震えた。');
                    }
                }
                
                return {
                    text: finalResponse,
                    responseTime: Math.floor(Math.random() * 2000) + 500,
                    agentId: agentId,
                    style: personality.style || 'sharp'
                };
            
            // AI Customizer API
            case 'ai:getPersonality':
                return {
                    success: true,
                    personality: {
                        name: 'シャープライター',
                        description: 'キレキレの文体を得意とする',
                        role: 'novelist',
                        tone: 'sharp',
                        traits: {
                            creativity: 80,
                            emotion: 60,
                            detail: 50,
                            conciseness: 90,
                            dialogue: 70,
                            action: 80
                        },
                        systemPrompt: 'あなたはキレキレの文体を得意とする小説家AIです...',
                        style: 'sharp'
                    }
                };
            
            case 'ai:savePersonality':
                console.log(`[Mock] Saving personality for ${data.agentId}:`, data.personality);
                return { success: true };
            
            case 'ai:savePreset':
                console.log(`[Mock] Saving preset "${data.name}":`, data.personality);
                return { success: true };
            
            case 'ai:testCustomPersonality':
                // Simulate AI test with custom personality
                const testResponses = [
                    '彼は振り返った。その瞬間、すべてが変わった。',
                    '街の向こうから聞こえる音楽が、心の奥底に響いた。',
                    '雨が止んだ。空に虹が架かり、新しい始まりを告げていた。'
                ];
                
                const testResponse = testResponses[Math.floor(Math.random() * testResponses.length)];
                const qualityScore = Math.floor(Math.random() * 3) + 7; // 7-10
                
                return {
                    success: true,
                    response: testResponse,
                    responseTime: Math.floor(Math.random() * 1500) + 500,
                    qualityScore: qualityScore,
                    metrics: {
                        creativity: Math.floor(Math.random() * 30) + 70,
                        naturalness: Math.floor(Math.random() * 20) + 80,
                        consistency: Math.floor(Math.random() * 25) + 75
                    }
                };
            
            case 'ai:generateSample':
                const sampleTexts = {
                    continue: '時は流れ、季節は変わった。しかし彼女の想いだけは、変わることなくそこにあった。',
                    dialogue: '「君と出会えて良かった」\n彼の言葉は、夜空に響く音楽のように美しかった。',
                    scene: '古い喫茶店の窓際で、彼女はコーヒーカップを両手で包んでいた。外では雪が降り始めている。'
                };
                
                return {
                    success: true,
                    text: sampleTexts[data.action] || sampleTexts['continue']
                };
            
            // Knowledge API
            case 'knowledge:search':
                return [
                    { title: 'サンプル知識1', content: 'サンプルコンテンツ', preview: 'これはサンプルの知識です...' },
                    { title: 'サンプル知識2', content: 'サンプルコンテンツ2', preview: 'もう一つのサンプル知識です...' }
                ];
            
            // App info
            case 'app:getVersionInfo':
                return {
                    electron: 'Mock Electron v28.0.0',
                    node: 'Mock Node.js v18.17.0'
                };
            
            case 'app:checkForUpdates':
                return {
                    updateAvailable: false,
                    version: '1.0.0'
                };
            
            // Workflow API
            case 'workflow:start':
                return {
                    success: true,
                    data: { id: 'mock-workflow-' + Date.now() }
                };
            
            // Agent API
            case 'agent:startSession':
                return {
                    success: true,
                    sessionId: 'mock-session-' + Date.now(),
                    participants: data.participants || ['deputy_editor', 'writer', 'editor']
                };
            
            case 'agent:sendMessage':
                // Simulate agent responses
                const responses = {
                    deputy_editor: [
                        '面白いアイデアですね。構成の観点から検討してみましょう。',
                        'この展開は読者の興味を引くと思います。',
                        'より深みのある設定を考えてみてはいかがでしょうか。'
                    ],
                    writer: [
                        'その設定で魅力的なキャラクターを作ることができそうです。',
                        '感情的な要素を加えることで、より読者に響く物語になるでしょう。',
                        'このシーンの描写をもう少し詳しく考えてみましょう。'
                    ],
                    editor: [
                        '文章の流れを整理すると、より読みやすくなりそうです。',
                        'この部分の矛盾を解決する必要がありますね。',
                        '全体的な一貫性を保つために、設定を見直しましょう。'
                    ],
                    proofreader: [
                        '論理的な整合性を確認いたします。',
                        'この設定には潜在的な矛盾があるかもしれません。',
                        '時系列の整理が必要な箇所があります。'
                    ]
                };
                
                const agentResponse = {
                    id: Date.now(),
                    sessionId: data.sessionId,
                    agent: data.participants[Math.floor(Math.random() * data.participants.length)],
                    message: responses[data.participants[0]][Math.floor(Math.random() * 3)],
                    timestamp: new Date().toISOString(),
                    type: 'agent_response'
                };
                
                return { success: true, response: agentResponse };
            
            case 'agent:getPersonalities':
                return {
                    deputy_editor: [
                        { id: 'analytical', name: '分析的', description: '論理的で客観的な視点' },
                        { id: 'creative', name: '創造的', description: '革新的なアイデアを重視' },
                        { id: 'commercial', name: '商業的', description: '市場性を重視した判断' }
                    ],
                    writer: [
                        { id: 'emotional', name: '感情的', description: '感情に訴える表現を重視' },
                        { id: 'descriptive', name: '描写的', description: '詳細な描写を得意とする' },
                        { id: 'dialogue', name: '対話重視', description: 'キャラクターの対話を重視' }
                    ],
                    editor: [
                        { id: 'collaborative', name: '協調的', description: '建設的な提案を行う' },
                        { id: 'perfectionist', name: '完璧主義', description: '細部まで丁寧に検証' },
                        { id: 'reader_focused', name: '読者重視', description: '読者の視点を最優先' }
                    ],
                    proofreader: [
                        { id: 'meticulous', name: '細心', description: '細かいミスも見逃さない' },
                        { id: 'logical', name: '論理的', description: '論理的一貫性を重視' },
                        { id: 'systematic', name: '体系的', description: '体系的なアプローチ' }
                    ]
                };
            
            case 'agent:setPersonality':
                console.log(`[Mock] Setting personality for ${data.agentType}: ${data.personalityId}`);
                return { success: true };
            
            case 'agent:generatePlot':
                return {
                    success: true,
                    plot: {
                        title: '生成されたプロット: ' + (data.theme || '冒険の物語'),
                        premise: 'AIエージェントによって生成された魅力的な前提設定です。',
                        themes: ['友情', '成長', '冒険'],
                        characters: [
                            { name: '主人公', role: 'protagonist', description: '勇敢で好奇心旺盛な青年' },
                            { name: '相棒', role: 'companion', description: '忠実で知恵のある仲間' }
                        ],
                        setting: '魔法と科学が共存する現代的な世界',
                        conflicts: ['内なる迷い', '外的な脅威', '仲間との対立'],
                        structure: {
                            acts: 3,
                            chapters: 12,
                            climax: '最終決戦での真の力の覚醒'
                        }
                    }
                };
            
            // Project list API
            case 'project:list':
                return this.mockData.projects;
            
            // Serendipity Search API
            case 'serendipity:search':
                const searchTerms = ['魔法', '冒険', '友情', '秘密', '成長', '決断', '謎', '発見', '過去', '未来'];
                const mockResults = [];
                
                for (let i = 0; i < 8; i++) {
                    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
                    mockResults.push({
                        id: `serendipity-${i}`,
                        title: `${randomTerm}に関する${['アイデア', '設定', '概念', 'テーマ'][Math.floor(Math.random() * 4)]}`,
                        content: `これは${randomTerm}に関連する創作のヒントです。予期しない視点から物語を見つめ直すことで、新たな展開が見えてくるかもしれません。`,
                        relevance: Math.random() * 0.5 + 0.3, // 0.3-0.8
                        surprise: Math.random() * 0.7 + 0.3,  // 0.3-1.0
                        category: ['character', 'plot', 'setting', 'theme'][Math.floor(Math.random() * 4)],
                        tags: [randomTerm, '創作', 'インスピレーション'],
                        source: 'セレンディピティ検索'
                    });
                }
                
                return {
                    success: true,
                    results: mockResults,
                    searchQuery: data.query,
                    totalFound: mockResults.length,
                    searchTime: Math.floor(Math.random() * 500) + 200
                };
            
            case 'serendipity:discover':
                const discoveries = [
                    {
                        id: 'discovery-1',
                        title: '時間の錯覚',
                        content: '主人公が感じる時間の流れと実際の時間の違いを利用した物語構造',
                        surprise: 0.85,
                        category: 'technique',
                        inspiration: '物理学の相対性理論から着想を得た創作手法'
                    },
                    {
                        id: 'discovery-2', 
                        title: '記憶の断片',
                        content: '失われた記憶が物語の鍵となる謎解き要素',
                        surprise: 0.72,
                        category: 'plot',
                        inspiration: '心理学研究からのインスピレーション'
                    },
                    {
                        id: 'discovery-3',
                        title: '影の主人公',
                        content: '表の主人公とは別に、裏で物語を動かしている真の主人公の存在',
                        surprise: 0.91,
                        category: 'character',
                        inspiration: '古典演劇の技法からの発想'
                    }
                ];
                
                return {
                    success: true,
                    discovery: discoveries[Math.floor(Math.random() * discoveries.length)]
                };
            
            case 'serendipity:getRelated':
                const relatedItems = [];
                const baseItem = data.baseItemId;
                
                for (let i = 0; i < 5; i++) {
                    relatedItems.push({
                        id: `related-${baseItem}-${i}`,
                        title: `関連アイデア ${i + 1}`,
                        content: `ベースアイテム「${baseItem}」に関連する創作要素です。`,
                        relevance: Math.random() * 0.4 + 0.6, // 0.6-1.0 (高い関連性)
                        relationshipType: ['thematic', 'structural', 'emotional', 'conceptual'][Math.floor(Math.random() * 4)],
                        category: ['character', 'plot', 'setting', 'theme'][Math.floor(Math.random() * 4)]
                    });
                }
                
                return {
                    success: true,
                    related: relatedItems,
                    baseItem: baseItem
                };
            
            // Vector Search API (for serendipity backend)
            case 'vector:search':
                return {
                    success: true,
                    results: [
                        { id: 'v1', content: 'ベクトル検索結果1', similarity: 0.85 },
                        { id: 'v2', content: 'ベクトル検索結果2', similarity: 0.78 },
                        { id: 'v3', content: 'ベクトル検索結果3', similarity: 0.71 }
                    ]
                };
            
            // Anything Box API
            case 'anythingBox:create':
                const newItem = {
                    id: Date.now(),
                    type: data.type,
                    title: data.title || `${data.type}アイテム`,
                    content: data.content,
                    url: data.url,
                    tags: data.tags || [],
                    projectId: data.projectId,
                    created_at: new Date().toISOString(),
                    processed: false,
                    insights: null
                };
                
                // Store in mock data
                if (!this.mockData.anythingBoxItems) {
                    this.mockData.anythingBoxItems = [];
                }
                this.mockData.anythingBoxItems.push(newItem);
                
                return { success: true, item: newItem };
            
            case 'anythingBox:list':
                if (!this.mockData.anythingBoxItems) {
                    this.mockData.anythingBoxItems = [
                        {
                            id: 1,
                            type: 'text',
                            title: 'サンプルアイデア',
                            content: '時間旅行をテーマにした物語のアイデア',
                            tags: ['SF', 'タイムトラベル'],
                            created_at: '2024-01-01T00:00:00Z',
                            processed: true,
                            insights: ['過去と現在の対比', '因果関係の複雑さ']
                        },
                        {
                            id: 2,
                            type: 'url',
                            title: '参考記事',
                            content: 'https://example.com/article',
                            tags: ['資料', '研究'],
                            created_at: '2024-01-02T00:00:00Z',
                            processed: false,
                            insights: null
                        }
                    ];
                }
                
                return {
                    success: true,
                    items: this.mockData.anythingBoxItems.filter(item => 
                        !data.projectId || item.projectId === data.projectId
                    )
                };
            
            case 'anythingBox:processText':
                if (!data || typeof data !== 'string' || !data.trim()) {
                    throw new Error('Text content is required');
                }
                const textItem = {
                    id: Date.now(),
                    project_id: projectId,
                    type: 'text',
                    title: options?.title || 'テキストメモ ' + new Date().toLocaleDateString('ja-JP'),
                    content: data.trim(),
                    metadata: JSON.stringify({
                        source: 'text',
                        originalLength: data.length,
                        processedAt: new Date().toISOString(),
                        inspirations: [
                            { type: 'character', content: 'このテキストから着想を得た神秘的なキャラクター', confidence: 0.8 },
                            { type: 'scene', content: '静寂な夜に起こる不思議な出来事のシーン', confidence: 0.7 }
                        ]
                    }),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                if (!this.mockData.knowledgeEntries) {
                    this.mockData.knowledgeEntries = [];
                }
                this.mockData.knowledgeEntries.push(textItem);
                return textItem;
            
            case 'anythingBox:processURL':
                if (!data || typeof data !== 'string' || !data.trim()) {
                    throw new Error('URL is required');
                }
                const urlItem = {
                    id: Date.now(),
                    project_id: projectId,
                    type: 'url',
                    title: 'Webページ: ' + data,
                    content: 'Mock: ' + data + ' の内容',
                    metadata: JSON.stringify({
                        source: 'url',
                        url: data,
                        fetchedAt: new Date().toISOString(),
                        inspirations: [
                            { type: 'theme', content: '記憶と忘却の間で揺れ動く人間の心理', confidence: 0.9 },
                            { type: 'plot', content: '失われた記憶を取り戻す旅の物語', confidence: 0.6 }
                        ]
                    }),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                if (!this.mockData.knowledgeEntries) {
                    this.mockData.knowledgeEntries = [];
                }
                this.mockData.knowledgeEntries.push(urlItem);
                return urlItem;
            
            case 'anythingBox:process':
                // Simulate AI processing
                const processedItem = this.mockData.anythingBoxItems?.find(item => item.id === data.itemId);
                if (processedItem) {
                    processedItem.processed = true;
                    processedItem.insights = [
                        '創作の着想として活用できるポイント',
                        'キャラクター開発への応用可能性',
                        '物語構造への組み込み方法'
                    ];
                    processedItem.extractedConcepts = [
                        { concept: '感情の変化', relevance: 0.8 },
                        { concept: '環境の影響', relevance: 0.6 },
                        { concept: '人間関係', relevance: 0.9 }
                    ];
                }
                
                return {
                    success: true,
                    insights: processedItem?.insights || [],
                    concepts: processedItem?.extractedConcepts || []
                };
            
            case 'anythingBox:delete':
                if (this.mockData.anythingBoxItems) {
                    const index = this.mockData.anythingBoxItems.findIndex(item => item.id === data.itemId);
                    if (index >= 0) {
                        this.mockData.anythingBoxItems.splice(index, 1);
                        return { success: true };
                    }
                }
                return { success: false, error: 'Item not found' };
            
            case 'anythingBox:generateIdeas':
                return {
                    success: true,
                    ideas: [
                        {
                            title: '設定アイデア',
                            content: '収集したアイテムから導き出される世界観設定',
                            relevance: 0.85,
                            type: 'setting'
                        },
                        {
                            title: 'キャラクター案',
                            content: 'アイテムの特徴を反映したキャラクター',
                            relevance: 0.72,
                            type: 'character'
                        },
                        {
                            title: 'プロット要素',
                            content: 'コレクションから生まれる物語の展開',
                            relevance: 0.91,
                            type: 'plot'
                        }
                    ]
                };
            
            case 'anythingBox:abstract':
                // Simulate abstraction process
                const abstractions = [
                    {
                        level: '低',
                        content: data.content.replace(/具体的な/g, '一般的な').replace(/特定の/g, 'ある種の')
                    },
                    {
                        level: '中',
                        content: '人と人との関係性における葛藤と成長の物語'
                    },
                    {
                        level: '高',
                        content: '存在の本質と変化の普遍的なテーマ'
                    }
                ];
                
                return {
                    success: true,
                    data: {
                        abstractions: abstractions,
                        originalContent: data.content
                    }
                };
            
            case 'anythingBox:getRecent':
                const { projectId: pid, limit = 50 } = data || {};
                const projectEntries = (this.mockData.knowledgeEntries || [])
                    .filter(entry => entry.project_id === (pid || projectId))
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, limit);
                return { success: true, data: projectEntries };
            
            case 'anythingBox:concretize':
                // Simulate concretization process
                const variations = [
                    { type: 'SF', label: 'SF版' },
                    { type: 'fantasy', label: 'ファンタジー版' },
                    { type: 'mystery', label: 'ミステリー版' },
                    { type: 'romance', label: '恋愛版' },
                    { type: 'historical', label: '歴史版' }
                ];
                
                const ideas = variations.slice(0, 3).map((v, i) => ({
                    title: `${v.label}：${data.abstractions[1].content.substring(0, 20)}...`,
                    content: `【${v.label}】\n元のアイデアを${v.label}として再構築しました。\n\n${
                        v.type === 'SF' ? 'AIと人間の共生をテーマに、未来都市での出会いと別れを描く' :
                        v.type === 'fantasy' ? '魔法使いと普通の人間の交流を通じて、異なる世界の理解を深める物語' :
                        v.type === 'mystery' ? '失踪事件の謎を追いながら、人間関係の複雑さに迫るサスペンス'
                        : '時代を超えた恋愛模様'
                    }`,
                    variation: v.label,
                    explanation: `抽象化された概念を${v.label}の文脈で具体化しました`
                }));
                
                return {
                    success: true,
                    data: {
                        ideas: ideas,
                        abstractionUsed: data.abstractions[1]
                    }
                };
            
            // Project Knowledge API
            case 'knowledge:list':
                // Get knowledge for a specific project
                const projectKnowledge = this.mockData.knowledge?.filter(k => 
                    k.projectId === data.projectId
                ) || [];
                
                return {
                    success: true,
                    knowledge: projectKnowledge
                };
            
            case 'knowledge:create':
                const newKnowledge = {
                    id: Date.now(),
                    projectId: data.projectId,
                    title: data.title,
                    category: data.category,
                    content: data.content,
                    tags: data.tags || [],
                    importance: data.importance || 'medium',
                    extraFields: data.extraFields || {},
                    relations: data.relations || [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                if (!this.mockData.knowledge) {
                    this.mockData.knowledge = [];
                }
                this.mockData.knowledge.push(newKnowledge);
                
                return { success: true, knowledge: newKnowledge };
            
            case 'knowledge:update':
                if (!this.mockData.knowledge) {
                    return { success: false, error: 'Knowledge not found' };
                }
                
                const knowledgeIndex = this.mockData.knowledge.findIndex(k => k.id === data.id);
                if (knowledgeIndex >= 0) {
                    this.mockData.knowledge[knowledgeIndex] = {
                        ...this.mockData.knowledge[knowledgeIndex],
                        ...data,
                        updated_at: new Date().toISOString()
                    };
                    return { success: true, knowledge: this.mockData.knowledge[knowledgeIndex] };
                }
                return { success: false, error: 'Knowledge not found' };
            
            case 'knowledge:delete':
                if (!this.mockData.knowledge) {
                    return { success: false, error: 'Knowledge not found' };
                }
                
                const knowledgeDeleteIndex = this.mockData.knowledge.findIndex(k => k.id === data.id);
                if (knowledgeDeleteIndex >= 0) {
                    this.mockData.knowledge.splice(knowledgeDeleteIndex, 1);
                    return { success: true };
                }
                return { success: false, error: 'Knowledge not found' };
            
            case 'knowledge:search':
                const searchResults = this.mockData.knowledge?.filter(k => {
                    const matchesProject = !data.projectId || k.projectId === data.projectId;
                    const matchesQuery = !data.query || 
                        k.title.toLowerCase().includes(data.query.toLowerCase()) ||
                        k.content.toLowerCase().includes(data.query.toLowerCase()) ||
                        k.tags.some(tag => tag.toLowerCase().includes(data.query.toLowerCase()));
                    const matchesCategory = !data.category || data.category === 'all' || k.category === data.category;
                    const matchesImportance = !data.importance || data.importance.length === 0 || data.importance.includes(k.importance);
                    const matchesTags = !data.tags || data.tags.length === 0 || data.tags.some(tag => k.tags.includes(tag));
                    
                    return matchesProject && matchesQuery && matchesCategory && matchesImportance && matchesTags;
                }) || [];
                
                return {
                    success: true,
                    results: searchResults,
                    totalFound: searchResults.length
                };
            
            case 'knowledge:getCategories':
                // Return category counts for a project
                const projectKnowledgeForCounts = this.mockData.knowledge?.filter(k => 
                    k.projectId === data.projectId
                ) || [];
                
                const categoryCounts = {
                    all: projectKnowledgeForCounts.length,
                    world: projectKnowledgeForCounts.filter(k => k.category === 'world').length,
                    character: projectKnowledgeForCounts.filter(k => k.category === 'character').length,
                    location: projectKnowledgeForCounts.filter(k => k.category === 'location').length,
                    item: projectKnowledgeForCounts.filter(k => k.category === 'item').length,
                    event: projectKnowledgeForCounts.filter(k => k.category === 'event').length,
                    other: projectKnowledgeForCounts.filter(k => k.category === 'other').length
                };
                
                return { success: true, counts: categoryCounts };
            
            case 'knowledge:getTags':
                // Get all unique tags for a project
                const projectKnowledgeForTags = this.mockData.knowledge?.filter(k => 
                    k.projectId === data.projectId
                ) || [];
                
                const allTags = new Set();
                projectKnowledgeForTags.forEach(k => {
                    k.tags.forEach(tag => allTags.add(tag));
                });
                
                return {
                    success: true,
                    tags: Array.from(allTags).sort()
                };
            
            case 'knowledge:getRelations':
                // Get knowledge items that could be related to the current one
                const availableForRelation = this.mockData.knowledge?.filter(k => 
                    k.projectId === data.projectId && k.id !== data.excludeId
                ) || [];
                
                return {
                    success: true,
                    knowledge: availableForRelation.map(k => ({
                        id: k.id,
                        title: k.title,
                        category: k.category
                    }))
                };
            
            case 'knowledge:generateSample':
                // Generate sample knowledge for a project
                if (!this.mockData.knowledge) {
                    this.mockData.knowledge = [];
                }
                
                const sampleKnowledge = [
                    {
                        id: Date.now() + 1,
                        projectId: data.projectId,
                        title: "アルカディア王国",
                        category: "world",
                        content: "物語の舞台となる魔法王国。技術と魔法が共存する独特な世界観を持つ。首都はクリスタルシティ。",
                        tags: ["世界観", "王国", "魔法", "主要設定"],
                        importance: "high",
                        extraFields: {},
                        relations: [],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        id: Date.now() + 2,
                        projectId: data.projectId,
                        title: "エリシア・ヴェルナード",
                        category: "character",
                        content: "主人公。18歳の魔法学院生。失われた記憶を持つ謎めいた少女。",
                        tags: ["主人公", "学生", "記憶", "謎"],
                        importance: "high",
                        extraFields: {
                            age: "18",
                            gender: "女性",
                            appearance: "銀髪、青い瞳、中肉中背",
                            personality: "好奇心旺盛だが内向的。記憶について悩んでいる。"
                        },
                        relations: [],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        id: Date.now() + 3,
                        projectId: data.projectId,
                        title: "クリスタルシティ",
                        category: "location",
                        content: "アルカディア王国の首都。巨大なクリスタルタワーが中央にそびえ立つ美しい都市。",
                        tags: ["首都", "都市", "クリスタル", "美しい"],
                        importance: "medium",
                        extraFields: {
                            type: "都市",
                            features: "中央のクリスタルタワー、魔法と技術の融合建築、空中庭園"
                        },
                        relations: [],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ];
                
                this.mockData.knowledge.push(...sampleKnowledge);
                
                return {
                    success: true,
                    message: `${sampleKnowledge.length}件のサンプル知識を追加しました`,
                    knowledge: sampleKnowledge
                };

            // Export API
            case 'export:getFormats':
                return {
                    success: true,
                    formats: [
                        { id: 'txt', name: 'プレーンテキスト (.txt)', extension: 'txt' },
                        { id: 'docx', name: 'Microsoft Word (.docx)', extension: 'docx' },
                        { id: 'pdf', name: 'PDF (.pdf)', extension: 'pdf' },
                        { id: 'epub', name: 'EPUB電子書籍 (.epub)', extension: 'epub' },
                        { id: 'html', name: 'HTML (.html)', extension: 'html' },
                        { id: 'markdown', name: 'Markdown (.md)', extension: 'md' },
                        { id: 'csv', name: 'CSV (データのみ) (.csv)', extension: 'csv' },
                        { id: 'json', name: 'JSON (全データ) (.json)', extension: 'json' }
                    ]
                };
            
            case 'export:project':
                // Simulate project export
                const exportData = {
                    project: this.mockData.projects.find(p => p.id === data.projectId),
                    plots: this.mockData.plots.filter(p => p.projectId === data.projectId),
                    knowledge: this.mockData.knowledge?.filter(k => k.projectId === data.projectId) || [],
                    chapters: [], // Would be populated from actual chapter data
                    analytics: {
                        totalWords: Math.floor(Math.random() * 50000) + 10000,
                        totalTime: Math.floor(Math.random() * 100) + 20,
                        sessionsCount: Math.floor(Math.random() * 50) + 10
                    }
                };
                
                return {
                    success: true,
                    data: exportData,
                    filename: `${exportData.project?.name || 'project'}_export.${data.format}`,
                    size: Math.floor(Math.random() * 1000000) + 100000 // Simulated file size in bytes
                };
            
            case 'export:analytics':
                // Export analytics data
                const analyticsExportData = {
                    exportDate: new Date().toISOString(),
                    period: data.period || '30 days',
                    writingStats: {
                        totalWords: 45230,
                        totalTime: 180,
                        averageDaily: 1507,
                        sessionsCount: 68
                    },
                    projectStats: [
                        {
                            name: 'サンプル小説プロジェクト',
                            words: 25000,
                            progress: 50,
                            chapters: 8
                        },
                        {
                            name: 'SF短編集',
                            words: 20230,
                            progress: 80,
                            chapters: 5
                        }
                    ],
                    dailyData: Array.from({ length: 30 }, (_, i) => ({
                        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        words: Math.floor(Math.random() * 2000) + 200,
                        time: Math.floor(Math.random() * 240) + 30
                    }))
                };
                
                return {
                    success: true,
                    data: analyticsExportData,
                    filename: `noveldrive_analytics_${data.period}.${data.format}`,
                    size: JSON.stringify(analyticsExportData).length
                };
            
            case 'export:knowledge':
                // Export knowledge base
                const knowledgeExportData = this.mockData.knowledge?.filter(k => 
                    !data.projectId || k.projectId === data.projectId
                ) || [];
                
                return {
                    success: true,
                    data: knowledgeExportData,
                    filename: `knowledge_base_${new Date().toISOString().split('T')[0]}.${data.format}`,
                    size: JSON.stringify(knowledgeExportData).length
                };
            
            case 'export:chapters':
                // Export chapter content
                const chaptersExportData = {
                    projectName: this.mockData.projects.find(p => p.id === data.projectId)?.name || 'Unknown Project',
                    chapters: data.chapterIds?.map(id => ({
                        id: id,
                        title: `Chapter ${id}`,
                        content: `これは章 ${id} のサンプルコンテンツです。\n\n実際のアプリケーションでは、ここに執筆された内容が含まれます。`,
                        wordCount: Math.floor(Math.random() * 3000) + 500,
                        notes: `章 ${id} のメモです。`
                    })) || [],
                    metadata: {
                        exportDate: new Date().toISOString(),
                        format: data.format,
                        includeNotes: data.includeNotes || false,
                        includeMetadata: data.includeMetadata || true
                    }
                };
                
                return {
                    success: true,
                    data: chaptersExportData,
                    filename: `${chaptersExportData.projectName}_chapters.${data.format}`,
                    size: JSON.stringify(chaptersExportData).length
                };
            
            case 'export:selectPath':
                // Simulate file path selection
                return {
                    success: true,
                    path: `/mock/exports/${data.filename || 'export.txt'}`
                };
            
            case 'export:saveFile':
                // Simulate file save
                console.log(`[Mock] Saving export file: ${data.filename}`);
                console.log(`[Mock] Content size: ${data.content?.length || 0} characters`);
                
                return {
                    success: true,
                    path: data.path || `/mock/exports/${data.filename}`,
                    size: data.content?.length || 0
                };

            // Analytics API
            case 'analytics:getWritingStats':
                const days = 30;
                const dailyStats = [];
                const today = new Date();
                
                for (let i = days - 1; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    
                    dailyStats.push({
                        date: date.toISOString().split('T')[0],
                        wordsWritten: Math.floor(Math.random() * 2000) + 200,
                        timeSpent: Math.floor(Math.random() * 240) + 30, // minutes
                        sessionsCount: Math.floor(Math.random() * 5) + 1,
                        projectsWorked: Math.floor(Math.random() * 3) + 1
                    });
                }
                
                return {
                    success: true,
                    period: `${days}日間`,
                    totalWords: dailyStats.reduce((sum, day) => sum + day.wordsWritten, 0),
                    totalTime: dailyStats.reduce((sum, day) => sum + day.timeSpent, 0),
                    averageDaily: Math.floor(dailyStats.reduce((sum, day) => sum + day.wordsWritten, 0) / days),
                    dailyStats: dailyStats,
                    weeklyGoal: 7000,
                    monthlyGoal: 30000
                };
            
            case 'analytics:getProjectStats':
                return {
                    success: true,
                    projects: [
                        {
                            id: 1,
                            name: 'サンプル小説プロジェクト',
                            totalWords: 15420,
                            targetWords: 50000,
                            progress: 0.31,
                            chaptersCompleted: 5,
                            totalChapters: 15,
                            lastUpdate: '2024-07-06',
                            estimatedCompletion: '2024-09-15'
                        },
                        {
                            id: 2,
                            name: 'SF短編集',
                            totalWords: 8930,
                            targetWords: 25000,
                            progress: 0.36,
                            chaptersCompleted: 3,
                            totalChapters: 8,
                            lastUpdate: '2024-07-05',
                            estimatedCompletion: '2024-08-20'
                        }
                    ]
                };
            
            case 'analytics:getProductivityInsights':
                return {
                    success: true,
                    insights: [
                        {
                            type: 'peak_hours',
                            title: '最も生産性の高い時間帯',
                            description: '午前9時〜11時が最も集中して執筆できています',
                            value: '09:00-11:00',
                            confidence: 0.85
                        },
                        {
                            type: 'streak',
                            title: '連続執筆日数',
                            description: '現在7日連続で執筆を継続中です',
                            value: '7日',
                            confidence: 1.0
                        },
                        {
                            type: 'word_velocity',
                            title: '執筆速度の傾向',
                            description: '先月と比較して15%執筆速度が向上しています',
                            value: '+15%',
                            confidence: 0.78
                        }
                    ],
                    recommendations: [
                        '午前中の集中時間を活用して重要な章の執筆を進めましょう',
                        '現在の連続記録を維持するため、短時間でも毎日執筆することをお勧めします',
                        '執筆速度が向上しているので、より挑戦的な目標設定を検討してみてください'
                    ]
                };
            
            case 'analytics:getGenreAnalysis':
                return {
                    success: true,
                    genres: [
                        { name: 'ファンタジー', count: 3, percentage: 50, totalWords: 25000 },
                        { name: 'SF', count: 2, percentage: 33, totalWords: 18000 },
                        { name: 'ミステリー', count: 1, percentage: 17, totalWords: 8000 }
                    ],
                    trends: [
                        { genre: 'ファンタジー', trend: 'increasing', change: '+25%' },
                        { genre: 'SF', trend: 'stable', change: '±0%' },
                        { genre: 'ミステリー', trend: 'new', change: 'New' }
                    ]
                };
            
            case 'analytics:getGoalProgress':
                return {
                    success: true,
                    goals: [
                        {
                            id: 1,
                            type: 'daily',
                            target: 1000,
                            current: 750,
                            unit: 'words',
                            progress: 0.75,
                            status: 'in_progress',
                            deadline: new Date().toISOString()
                        },
                        {
                            id: 2,
                            type: 'weekly',
                            target: 7000,
                            current: 4200,
                            unit: 'words',
                            progress: 0.6,
                            status: 'in_progress',
                            deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
                        },
                        {
                            id: 3,
                            type: 'monthly',
                            target: 30000,
                            current: 18500,
                            unit: 'words',
                            progress: 0.62,
                            status: 'in_progress',
                            deadline: new Date(2024, 7, 31).toISOString()
                        }
                    ]
                };
            
            // Dialog API
            case 'dialog:selectDirectory':
                // Simulate directory selection dialog
                const directories = [
                    '/Users/user/Documents/NovelDrive',
                    '/Users/user/Desktop/Creative Writing',
                    '/Users/user/Projects/Stories',
                    'C:\\Users\\user\\Documents\\NovelDrive',
                    'C:\\Creative\\Projects'
                ];
                const selectedDir = directories[Math.floor(Math.random() * directories.length)];
                console.log(`[Mock] Directory selected: ${selectedDir}`);
                return selectedDir;
            
            // Cache API
            case 'cache:clear':
                return { success: true };
            
            // Backup API
            case 'backup:create':
                const backupFilename = `noveldrive_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.backup`;
                console.log(`[Mock] Creating backup: ${backupFilename}`);
                
                if (!this.mockData.backups) {
                    this.mockData.backups = [];
                }
                
                const newBackup = {
                    id: Date.now().toString(),
                    name: backupFilename,
                    date: new Date().toISOString(),
                    size: Math.floor(Math.random() * 50000000) + 10000000, // 10-60MB
                    projects: this.mockData.projects.length,
                    chapters: Math.floor(Math.random() * 50) + 10
                };
                
                this.mockData.backups.push(newBackup);
                
                return {
                    success: true,
                    filename: backupFilename,
                    backup: newBackup
                };
            
            case 'backup:list':
                if (!this.mockData.backups) {
                    this.mockData.backups = [
                        {
                            id: '1',
                            name: 'noveldrive_backup_2024-07-01T10-30-00.backup',
                            date: '2024-07-01T10:30:00.000Z',
                            size: 25600000,
                            projects: 3,
                            chapters: 15
                        },
                        {
                            id: '2',
                            name: 'noveldrive_backup_2024-07-05T15-45-00.backup',
                            date: '2024-07-05T15:45:00.000Z',
                            size: 31200000,
                            projects: 3,
                            chapters: 18
                        }
                    ];
                }
                
                return this.mockData.backups.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            case 'backup:restore':
                const backup = this.mockData.backups?.find(b => b.id === data.backupId);
                if (!backup) {
                    return { success: false, error: 'Backup not found' };
                }
                
                console.log(`[Mock] Restoring backup: ${backup.name}`);
                return {
                    success: true,
                    message: `バックアップ「${backup.name}」を復元しました`
                };
            
            case 'backup:delete':
                if (!this.mockData.backups) {
                    return { success: false, error: 'Backup not found' };
                }
                
                const backupIndex = this.mockData.backups.findIndex(b => b.id === data.backupId);
                if (backupIndex >= 0) {
                    const deletedBackup = this.mockData.backups.splice(backupIndex, 1)[0];
                    console.log(`[Mock] Deleted backup: ${deletedBackup.name}`);
                    return { success: true };
                }
                
                return { success: false, error: 'Backup not found' };
            
            // Storage API
            case 'storage:getInfo':
                const dbSize = Math.floor(Math.random() * 100000000) + 50000000; // 50-150MB
                const cacheSize = Math.floor(Math.random() * 20000000) + 5000000; // 5-25MB
                const backupsSize = (this.mockData.backups || []).reduce((total, backup) => total + backup.size, 0);
                
                return {
                    success: true,
                    database: dbSize,
                    cache: cacheSize,
                    backups: backupsSize,
                    total: dbSize + cacheSize + backupsSize,
                    projects: this.mockData.projects.length,
                    knowledge: this.mockData.knowledge?.length || 0,
                    anythingBoxItems: this.mockData.anythingBoxItems?.length || 0
                };
            
            // Project workspace API
            case 'project:getStats':
                const projectStats = {
                    totalWords: Math.floor(Math.random() * 25000) + 5000,
                    targetWords: 50000,
                    chaptersCompleted: Math.floor(Math.random() * 8) + 2,
                    totalChapters: 15,
                    dailyWords: Math.floor(Math.random() * 1500) + 200,
                    weeklyWords: Math.floor(Math.random() * 8000) + 2000,
                    totalSessions: Math.floor(Math.random() * 25) + 10,
                    avgDaily: Math.floor(Math.random() * 800) + 400
                };
                
                return { success: true, data: projectStats };
            
            case 'project:getTimeline':
                const timelineData = [
                    {
                        id: 1,
                        type: 'writing',
                        description: '第3章「出会い」を編集',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        details: { chapterId: 2, wordsAdded: 350 }
                    },
                    {
                        id: 2,
                        type: 'planning',
                        description: 'キャラクター「エリシア」を追加',
                        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        details: { characterId: 1 }
                    },
                    {
                        id: 3,
                        type: 'editing',
                        description: 'プロット会議を実行',
                        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                        details: { sessionType: 'plot_development' }
                    }
                ];
                
                return { success: true, timeline: timelineData };
            
            // Chapter API
            case 'chapter:list':
                const chaptersData = [
                    {
                        id: 1,
                        title: '第1章 始まりの街',
                        summary: '主人公が新しい街に到着し、冒険が始まる',
                        wordCount: 2500,
                        targetWords: 3000,
                        status: 'completed',
                        lastModified: '2024-07-05T10:30:00Z'
                    },
                    {
                        id: 2,
                        title: '第2章 出会い',
                        summary: '重要なキャラクターとの出会い',
                        wordCount: 1800,
                        targetWords: 3000,
                        status: 'in_progress',
                        lastModified: '2024-07-06T09:15:00Z'
                    },
                    {
                        id: 3,
                        title: '第3章 謎の手がかり',
                        summary: '物語の核心に関わる手がかりを発見',
                        wordCount: 0,
                        targetWords: 3500,
                        status: 'planned',
                        lastModified: null
                    }
                ];
                
                return { success: true, chapters: chaptersData };
            
            case 'chapter:create':
                const newChapter = {
                    id: Date.now(),
                    projectId: data.projectId,
                    title: data.title,
                    summary: data.summary,
                    order: data.order,
                    targetWords: data.targetWords,
                    wordCount: 0,
                    status: 'planned',
                    lastModified: new Date().toISOString()
                };
                
                return { success: true, chapter: newChapter };

            // Data management API
            case 'data:resetAll':
                console.log('[Mock] Resetting all data...');
                
                // Reset all mock data
                this.mockData = {
                    projects: [],
                    plots: [],
                    knowledge: [],
                    anythingBoxItems: [],
                    backups: [],
                    settings: {
                        api: { openai: { hasApiKey: false, model: "gpt-4", temperature: 0.7, isConfigured: false } },
                        ai: { writerModerateIgnorance: true, responseLength: "medium", language: "ja" },
                        editor: { fontSize: "16", lineHeight: "1.6", showLineNumbers: false, wordWrap: true },
                        export: { defaultFormat: "txt", includeMetadata: true, includeNotes: false },
                        advanced: { dataLocation: "/mock/data/path", enable24hMode: false, debugMode: false }
                    }
                };
                
                return {
                    success: true,
                    message: 'すべてのデータをリセットしました'
                };

            // Shell API
            case 'shell:openExternal':
                console.log(`[Mock] Opening external URL: ${data.url}`);
                window.open(data.url, '_blank');
                return { success: true };
            
            // Thread API
            case 'thread:save':
                console.log('[Mock API] Saving thread data:', data);
                localStorage.setItem('ai-thread-manager', JSON.stringify(data));
                return { success: true };
            
            case 'thread:load':
                const savedThreadData = localStorage.getItem('ai-thread-manager');
                if (savedThreadData) {
                    return JSON.parse(savedThreadData);
                }
                return { version: '1.0', threads: [], lastSaved: new Date().toISOString() };
            
            case 'thread:getByProject':
                const allThreadData = localStorage.getItem('ai-thread-manager');
                if (allThreadData) {
                    const parsed = JSON.parse(allThreadData);
                    const projectThreads = parsed.threads.filter(thread => thread.projectId === data);
                    return projectThreads;
                }
                return [];
            
            case 'thread:clear':
                const threadData = localStorage.getItem('ai-thread-manager');
                if (threadData) {
                    const parsed = JSON.parse(threadData);
                    parsed.threads = parsed.threads.filter(thread => 
                        !(thread.agentId === data.agentId && thread.projectId === data.projectId)
                    );
                    parsed.lastSaved = new Date().toISOString();
                    localStorage.setItem('ai-thread-manager', JSON.stringify(parsed));
                }
                return { success: true };
            
            // Backup API
            case 'backup:list':
                // Mock backup list
                if (!this.mockData.backups) {
                    this.mockData.backups = [];
                }
                return {
                    success: true,
                    backups: this.mockData.backups.map((backup, index) => ({
                        id: backup.id || index + 1,
                        name: backup.name || `バックアップ ${index + 1}`,
                        date: backup.date || new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
                        size: backup.size || Math.floor(Math.random() * 10000000) + 1000000,
                        projectCount: backup.projectCount || Math.floor(Math.random() * 5) + 1
                    }))
                };
            
            case 'backup:create':
                const createdBackup = {
                    id: Date.now(),
                    name: data.name || `バックアップ ${new Date().toLocaleDateString('ja-JP')}`,
                    date: new Date().toISOString(),
                    size: Math.floor(Math.random() * 10000000) + 1000000,
                    projectCount: this.mockData.projects.length
                };
                if (!this.mockData.backups) {
                    this.mockData.backups = [];
                }
                this.mockData.backups.unshift(createdBackup);
                return { success: true, backup: createdBackup };
            
            case 'backup:restore':
                console.log('[Mock] Restoring backup:', data.backupId);
                return { success: true, message: 'バックアップを復元しました' };
            
            case 'backup:delete':
                if (this.mockData.backups) {
                    this.mockData.backups = this.mockData.backups.filter(b => b.id !== data.backupId);
                }
                return { success: true };
            
            // Storage API
            case 'storage:getInfo':
                return {
                    success: true,
                    storage: {
                        total: 500 * 1024 * 1024 * 1024, // 500GB
                        used: Math.floor(Math.random() * 50 * 1024 * 1024 * 1024), // Random up to 50GB
                        available: 450 * 1024 * 1024 * 1024,
                        appData: {
                            projects: Math.floor(Math.random() * 100 * 1024 * 1024), // Random up to 100MB
                            knowledge: Math.floor(Math.random() * 50 * 1024 * 1024), // Random up to 50MB
                            analytics: Math.floor(Math.random() * 20 * 1024 * 1024), // Random up to 20MB
                            backups: Math.floor(Math.random() * 200 * 1024 * 1024), // Random up to 200MB
                            other: Math.floor(Math.random() * 30 * 1024 * 1024) // Random up to 30MB
                        },
                        dataPath: '/mock/data/path/noveldrive'
                    }
                };
            
            // URL Discussion API
            case 'urlDiscussion:generateIdeas':
                console.log('[Mock API] Generating ideas from URL:', data.url);
                
                // Simulate AI discussion
                const mockDiscussion = {
                    url: data.url,
                    title: `ページタイトル: ${new URL(data.url).hostname}`,
                    startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
                    endTime: new Date(),
                    duration: 5 * 60 * 1000,
                    stages: [
                        {
                            agent: 'analyst',
                            stage: 'analysis',
                            content: {
                                agent: '分析者',
                                analysis: `URLから取得したコンテンツを分析しました。このページは${new URL(data.url).hostname}に関する情報を含んでおり、特に技術的な内容と創造的な要素の組み合わせが興味深いです。`
                            },
                            timestamp: new Date(Date.now() - 4 * 60 * 1000)
                        },
                        {
                            agent: 'creative',
                            stage: 'ideation',
                            content: {
                                agent: '創造者',
                                ideas: '分析結果を基に、5つの小説アイディアを考案しました。1) 近未来SF：AIと人間の共創物語、2) ファンタジー：魔法とテクノロジーの融合、3) ミステリー：デジタル世界の謎解き...',
                                ideaList: [
                                    { title: 'AIと人間の共創物語', genre: 'SF', summary: '人工知能と人間が協力して新しい世界を創造する' },
                                    { title: '魔法とテクノロジーの融合', genre: 'ファンタジー', summary: '現代技術と古代魔法が交差する世界' }
                                ]
                            },
                            timestamp: new Date(Date.now() - 3 * 60 * 1000)
                        },
                        {
                            agent: 'editor',
                            stage: 'refinement',
                            content: {
                                agent: '編集者',
                                refinedIdeas: 'アイディアを整理し、最も有望な3つに絞り込みました。それぞれのプロット概要とキャラクター設定を詳細化しました。'
                            },
                            timestamp: new Date(Date.now() - 2 * 60 * 1000)
                        },
                        {
                            agent: 'all',
                            stage: 'final_discussion',
                            content: {
                                discussion: '全員で議論した結果、「AIと人間の共創物語」が最も興味深く、現代的なテーマとして優れていると結論づけました。',
                                finalDecision: {
                                    title: 'コード・オブ・クリエイション',
                                    summary: 'AIプログラマーと創作AIが協力して、現実と仮想が交錯する新しい物語世界を創造する近未来SF',
                                    fullText: '詳細な企画内容...'
                                }
                            },
                            timestamp: new Date(Date.now() - 1 * 60 * 1000)
                        }
                    ]
                };
                
                // Save generated ideas
                const savedIdea = {
                    id: Date.now(),
                    project_id: data.projectId,
                    type: 'url_generated_idea',
                    title: 'コード・オブ・クリエイション',
                    content: JSON.stringify({
                        url: data.url,
                        urlTitle: mockDiscussion.title,
                        decision: mockDiscussion.stages[3].content.finalDecision,
                        discussion: mockDiscussion.stages
                    }),
                    metadata: JSON.stringify({
                        source: 'url_discussion',
                        generatedAt: new Date().toISOString(),
                        discussionDuration: mockDiscussion.duration,
                        agents: ['analyst', 'creative', 'editor']
                    }),
                    created_at: new Date().toISOString()
                };
                
                if (!this.mockData.knowledge) {
                    this.mockData.knowledge = [];
                }
                this.mockData.knowledge.push(savedIdea);
                
                return {
                    success: true,
                    data: {
                        discussion: mockDiscussion,
                        ideas: [savedIdea],
                        summary: {
                            decision: 'コード・オブ・クリエイション',
                            keyPoints: 'AIと人間の協力をテーマにした近未来SF小説',
                            nextSteps: '執筆に向けた準備を開始してください'
                        }
                    }
                };
            
            case 'urlDiscussion:getHistory':
                const urlIdeas = (this.mockData.knowledge || []).filter(item => {
                    try {
                        const metadata = JSON.parse(item.metadata || '{}');
                        return metadata.source === 'url_discussion';
                    } catch {
                        return false;
                    }
                });
                
                return { success: true, data: urlIdeas };
            
            case 'urlDiscussion:convertToPlot':
                const idea = (this.mockData.knowledge || []).find(k => k.id === data.ideaId);
                if (!idea) {
                    return { success: false, error: 'Idea not found' };
                }
                
                const generatedPlot = {
                    id: Date.now(),
                    project_id: data.projectId,
                    title: 'URLから生成されたプロット',
                    premise: '生成されたプロットの前提',
                    themes: ['AI', '創造性', '協力'],
                    characters: [],
                    settings: {},
                    conflicts: [],
                    structure: {},
                    key_scenes: [],
                    metadata: JSON.stringify({
                        source: 'url_discussion',
                        sourceIdeaId: data.ideaId,
                        generatedAt: new Date().toISOString()
                    }),
                    created_at: new Date().toISOString()
                };
                
                if (!this.mockData.plots) {
                    this.mockData.plots = [];
                }
                this.mockData.plots.push(generatedPlot);
                
                return { success: true, data: generatedPlot };
            
            // Custom Agent API
            case 'agent:create':
                console.log('[Mock API] Creating custom agent:', data);
                
                const customAgent = {
                    id: `custom-${Date.now()}`,
                    ...data,
                    createdAt: new Date().toISOString(),
                    isCustom: true
                };
                
                if (!this.mockData.customAgents) {
                    this.mockData.customAgents = [];
                }
                this.mockData.customAgents.push(customAgent);
                
                return { success: true, data: customAgent };
            
            case 'agent:getCustom':
                return {
                    success: true,
                    data: this.mockData.customAgents || []
                };
            
            case 'agent:delete':
                if (this.mockData.customAgents) {
                    this.mockData.customAgents = this.mockData.customAgents.filter(
                        agent => agent.id !== data
                    );
                }
                return { success: true };
            
            // Agent Session API
            case 'agents:startSession':
                const sessionId = `session-${Date.now()}`;
                const session = {
                    id: sessionId,
                    type: data.type,
                    participants: data.participants,
                    projectId: data.projectId,
                    context: data.context,
                    startTime: new Date(),
                    messages: []
                };
                
                if (!this.mockData.activeSessions) {
                    this.mockData.activeSessions = new Map();
                }
                this.mockData.activeSessions.set(sessionId, session);
                
                console.log('[Mock API] Started agent session:', sessionId);
                return session;
            
            case 'agents:sendMessage':
                const activeSession = this.mockData.activeSessions?.get(data.sessionId);
                if (!activeSession) {
                    throw new Error('Session not found');
                }
                
                // Simulate agent responses
                setTimeout(() => {
                    const agents = ['deputy_editor', 'writer', 'editor', 'proofreader'];
                    const responses = {
                        deputy_editor: 'なるほど、その視点は物語の構造を深める良いアプローチですね。',
                        writer: 'その設定を使って、こんなシーンを書いてみるのはどうでしょうか...',
                        editor: '読者への訴求力を考えると、もう少し感情的な要素を加えてもいいかもしれません。',
                        proofreader: '一貫性の観点から、この部分は前のセクションとの整合性を確認する必要があります。'
                    };
                    
                    // Send responses from participating agents
                    activeSession.participants.forEach((participant, index) => {
                        setTimeout(() => {
                            const agentType = participant.replace('custom_', '');
                            const message = responses[agentType] || 'エージェントからの応答です。';
                            
                            this.emit('agents:message', {
                                sessionId: data.sessionId,
                                agentType: participant,
                                message: message,
                                timestamp: new Date()
                            });
                        }, 1000 + index * 500);
                    });
                }, 500);
                
                return { success: true };
            
            case 'agents:endSession':
                if (this.mockData.activeSessions) {
                    this.mockData.activeSessions.delete(data.sessionId);
                }
                return { success: true };
            
            case 'agents:getStatus':
                return {
                    deputy_editor: { status: 'idle', capabilities: ['review', 'critique'] },
                    writer: { status: 'idle', capabilities: ['create', 'write'] },
                    editor: { status: 'idle', capabilities: ['edit', 'suggest'] },
                    proofreader: { status: 'idle', capabilities: ['proofread', 'consistency'] }
                };
            
            case 'agents:generatePlot':
                setTimeout(() => {
                    this.emit('agents:plotGenerated', {
                        sessionId: data.sessionId,
                        plot: {
                            title: 'AIが生成したプロット',
                            premise: 'モックプロットの前提',
                            themes: ['テーマ1', 'テーマ2'],
                            characters: [
                                { name: '主人公', role: 'protagonist', description: '主人公の説明' }
                            ],
                            structure: { acts: 3, chapters: 12 }
                        }
                    });
                }, 2000);
                
                return { success: true };
            
            default:
                console.warn(`[Mock API] Unhandled channel: ${channel}`);
                return { success: false, error: `Mock API: ${channel} not implemented` };
        }
    }

    showMessage(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
        `;
        
        const colors = {
            error: '#f44336',
            success: '#4CAF50',
            info: '#2196F3',
            warning: '#FF9800'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        console.log(`[Mock Message] ${type.toUpperCase()}: ${message}`);
    }
    
    // Mock event emitter
    on(event, callback) {
        if (!this.eventHandlers) {
            this.eventHandlers = {};
        }
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(callback);
    }
    
    emit(event, data) {
        if (this.eventHandlers && this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(callback => callback(data));
        }
    }
}

// Initialize mock API if not in Electron environment
if (typeof window !== 'undefined' && !window.api) {
    const mockAPI = new MockAPI();
    window.api = {
        invoke: mockAPI.invoke.bind(mockAPI),
        showMessage: mockAPI.showMessage.bind(mockAPI),
        on: mockAPI.on.bind(mockAPI),
        emit: mockAPI.emit.bind(mockAPI)
    };
    
    // Also expose mockAPI for compatibility
    window.mockAPI = window.api;
    
    console.log('[Mock API] Initialized for browser environment');
    console.log('[Mock API] Available projects:', mockAPI.mockData.projects.length);
}