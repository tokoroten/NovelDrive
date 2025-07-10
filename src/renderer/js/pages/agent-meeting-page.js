// Agent Meeting Page Component

const { useState, useEffect, createElement: h } = React;

function AgentMeetingPage() {
    const currentProjectId = window.useStore(state => state.currentProjectId);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    
    return h('div', null,
        h('header', { className: 'page-header' },
            h('div', null,
                h('h2', null, 'エージェント会議室'),
                h('p', { className: 'page-description' }, 'AIエージェントたちと小説の構想を練り上げましょう')
            )
        ),
        
        !currentProjectId ? 
            h('div', { className: 'empty-state' },
                h('div', { className: 'empty-icon' }, '🤝'),
                h('h3', null, 'プロジェクトを選択してください'),
                h('p', null, 'エージェント会議を開始するには、プロジェクトの選択が必要です。')
            ) :
            h('div', { className: 'meeting-container' },
                h('div', { className: 'meeting-area' }, 
                    h('p', null, 'エージェント会議の実装予定')
                )
            )
    );
}

// Export for use in SPA
window.AgentMeetingPage = AgentMeetingPage;