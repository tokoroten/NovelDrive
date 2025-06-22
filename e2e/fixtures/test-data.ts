export const testData = {
  anythingBox: {
    sampleNote: {
      content: '今日は新しい小説のアイデアを思いついた。AIと人間が協力して創作する未来の物語。',
      expectedInspirations: ['AI', '協力', '創作', '未来'],
    },
    sampleUrl: {
      content: 'https://example.com/article-about-creativity',
      expectedType: 'url',
    },
    sampleImage: {
      content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      expectedType: 'image',
    },
  },
  project: {
    sampleProject: {
      title: 'テスト小説プロジェクト',
      description: 'E2Eテスト用のサンプルプロジェクト',
      genre: 'SF',
      targetLength: '短編',
    },
  },
  knowledgeGraph: {
    searchQuery: 'AI',
    expectedNodeCount: 1,
  },
  agent: {
    plotIdea: '未来都市を舞台にしたAIと人間の友情物語',
    expectedDiscussionLength: 3,
  },
};