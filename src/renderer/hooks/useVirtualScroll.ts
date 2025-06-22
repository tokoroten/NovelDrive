import { useState, useEffect, useCallback, useRef } from 'react';
import { getVisibleItems } from '../utils/performance';

interface UseVirtualScrollOptions {
  itemHeight: number;
  overscan?: number;
  getItemHeight?: (index: number) => number;
}

interface UseVirtualScrollResult<T> {
  visibleItems: T[];
  totalHeight: number;
  offsetY: number;
  startIndex: number;
  endIndex: number;
  scrollToIndex: (index: number) => void;
}

export function useVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  options: UseVirtualScrollOptions
): UseVirtualScrollResult<T> {
  const { itemHeight, overscan = 3, getItemHeight } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLElement | null>(null);

  // 可変高さの場合の高さキャッシュ
  const heightCache = useRef<Map<number, number>>(new Map());

  // アイテムの高さを取得
  const getHeight = useCallback((index: number): number => {
    if (getItemHeight) {
      if (!heightCache.current.has(index)) {
        heightCache.current.set(index, getItemHeight(index));
      }
      return heightCache.current.get(index)!;
    }
    return itemHeight;
  }, [itemHeight, getItemHeight]);

  // 累積高さを計算
  const getOffsetForIndex = useCallback((index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getHeight(i);
    }
    return offset;
  }, [getHeight]);

  // 表示アイテムを計算
  const { visibleItems, startIndex, endIndex } = getVisibleItems(
    items,
    containerHeight,
    itemHeight,
    scrollTop,
    overscan
  );

  // 全体の高さを計算
  const totalHeight = items.length * itemHeight;

  // オフセットYを計算
  const offsetY = startIndex * itemHeight;

  // スクロール位置を設定
  const scrollToIndex = useCallback((index: number) => {
    const offset = getOffsetForIndex(index);
    if (scrollElementRef.current) {
      scrollElementRef.current.scrollTop = offset;
    }
    setScrollTop(offset);
  }, [getOffsetForIndex]);

  // スクロールイベントハンドラー
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  // スクロールイベントの登録
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    scrollToIndex,
  };
}

/**
 * 無限スクロール用のフック
 */
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  options: {
    threshold?: number;
    rootMargin?: string;
  } = {}
) {
  const { threshold = 0.1, rootMargin = '100px' } = options;
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const handleIntersect = async (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isLoading) {
        setIsLoading(true);
        try {
          await loadMore();
        } finally {
          setIsLoading(false);
        }
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin,
    });

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, threshold, rootMargin, isLoading]);

  return {
    sentinelRef,
    isLoading,
  };
}