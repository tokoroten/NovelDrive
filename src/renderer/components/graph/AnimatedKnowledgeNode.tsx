import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnimatedKnowledgeNodeData {
  label: string;
  type: string;
  content: string;
  selected?: boolean;
  similarity?: number;
  isHighlighted?: boolean;
  connectionCount?: number;
  metadata?: Record<string, unknown>;
}

const AnimatedKnowledgeNode = memo(({ data, selected }: NodeProps<AnimatedKnowledgeNodeData>) => {
  const [isHovered, setIsHovered] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // ノードタイプに基づいた色とアイコン
  const getNodeStyle = (type: string) => {
    const styles: Record<string, { color: string; icon: string; gradient: string }> = {
      inspiration: {
        color: '#8B5CF6',
        icon: '💡',
        gradient: 'from-purple-400 to-purple-600',
      },
      article: {
        color: '#3B82F6',
        icon: '📄',
        gradient: 'from-blue-400 to-blue-600',
      },
      idea: {
        color: '#10B981',
        icon: '💭',
        gradient: 'from-emerald-400 to-emerald-600',
      },
      url: {
        color: '#F59E0B',
        icon: '🔗',
        gradient: 'from-amber-400 to-amber-600',
      },
      image: {
        color: '#EF4444',
        icon: '🖼️',
        gradient: 'from-red-400 to-red-600',
      },
      audio: {
        color: '#EC4899',
        icon: '🎵',
        gradient: 'from-pink-400 to-pink-600',
      },
      default: {
        color: '#6B7280',
        icon: '📌',
        gradient: 'from-gray-400 to-gray-600',
      },
    };
    return styles[type] || styles.default;
  };

  const nodeStyle = getNodeStyle(data.type);

  // 新規ノード追加時のアニメーション
  useEffect(() => {
    setPulseAnimation(true);
    const timer = setTimeout(() => setPulseAnimation(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: selected ? 1.1 : 1, 
          opacity: 1,
        }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative"
      >
        {/* パルスアニメーション */}
        {pulseAnimation && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            animate={{
              scale: [1, 1.5, 1.5],
              opacity: [0.5, 0, 0],
            }}
            transition={{
              duration: 1,
              repeat: 2,
            }}
            style={{ backgroundColor: nodeStyle.color }}
          />
        )}

        {/* ハイライト効果 */}
        {data.isHighlighted && (
          <motion.div
            className="absolute -inset-1 rounded-xl bg-gradient-to-r opacity-75 blur-sm"
            animate={{
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            style={{
              background: `linear-gradient(to right, ${nodeStyle.color}40, ${nodeStyle.color}80, ${nodeStyle.color}40)`,
            }}
          />
        )}

        {/* メインノード */}
        <div
          className={`
            relative px-4 py-3 rounded-xl shadow-lg border-2 
            bg-gradient-to-br text-white
            transition-all duration-200
            ${selected ? 'ring-4 ring-offset-2 ring-offset-white' : ''}
            ${isHovered ? 'shadow-2xl transform -translate-y-1' : ''}
          `}
          style={{
            borderColor: nodeStyle.color,
            background: data.isHighlighted 
              ? `linear-gradient(135deg, ${nodeStyle.color}dd, ${nodeStyle.color})`
              : 'white',
            color: data.isHighlighted ? 'white' : '#1f2937',
            '--tw-ring-color': nodeStyle.color,
          } as React.CSSProperties}
        >
          {/* ヘッダー */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{nodeStyle.icon}</span>
            <span className={`text-xs font-medium ${data.isHighlighted ? 'text-white/80' : 'text-gray-500'}`}>
              {data.type}
            </span>
            {data.connectionCount && data.connectionCount > 3 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs"
              >
                🔥 {data.connectionCount}
              </motion.span>
            )}
          </div>

          {/* ラベル */}
          <div className="font-semibold text-sm max-w-[200px] line-clamp-2">
            {data.label}
          </div>

          {/* 類似度インジケーター */}
          {data.similarity !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className={data.isHighlighted ? 'text-white/70' : 'text-gray-500'}>
                  関連度
                </span>
                <span className="font-medium">
                  {Math.round(data.similarity * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${data.similarity * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{
                    background: `linear-gradient(to right, ${nodeStyle.color}80, ${nodeStyle.color})`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ホバー時の詳細情報 */}
          <AnimatePresence>
            {isHovered && data.content && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 max-w-xs"
              >
                <div className="line-clamp-3">{String(data.content)}</div>
                {data.metadata?.tags && Array.isArray(data.metadata.tags) && data.metadata.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(data.metadata.tags as string[]).map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-white/20 rounded-full text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 接続ハンドル */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
          style={{ background: nodeStyle.color }}
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
          style={{ background: nodeStyle.color }}
        />
      </motion.div>
    </AnimatePresence>
  );
});

AnimatedKnowledgeNode.displayName = 'AnimatedKnowledgeNode';

export default AnimatedKnowledgeNode;