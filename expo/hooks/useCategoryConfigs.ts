import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CategoryConfig {
  categoryKey: string;
  displayName: string;
  iconEmoji: string;
  colorCode: string;
  commercialPriority: number;
  isActive: boolean;
  sortOrder: number;
}

interface CategoryConfigsState {
  categories: CategoryConfig[];
  categoriesMap: Map<string, CategoryConfig>;
  isLoading: boolean;
  error: string | null;
}

// 全局缓存，避免重复请求
let globalCache: {
  categories: CategoryConfig[];
  categoriesMap: Map<string, CategoryConfig>;
  lastFetch: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

export const useCategoryConfigs = () => {
  const [state, setState] = useState<CategoryConfigsState>({
    categories: [],
    categoriesMap: new Map(),
    isLoading: true,
    error: null,
  });

  const fetchCategories = async () => {
    try {
      // 检查缓存是否有效
      if (globalCache && Date.now() - globalCache.lastFetch < CACHE_DURATION) {
        setState({
          categories: globalCache.categories,
          categoriesMap: globalCache.categoriesMap,
          isLoading: false,
          error: null,
        });
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase
        .from('category_configs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const categories: CategoryConfig[] = (data || []).map(cat => ({
        categoryKey: cat.category_key,
        displayName: cat.display_name,
        iconEmoji: cat.icon_emoji,
        colorCode: cat.color_code,
        commercialPriority: cat.commercial_priority,
        isActive: cat.is_active,
        sortOrder: cat.sort_order,
      }));

      // 创建Map以便快速查找
      const categoriesMap = new Map<string, CategoryConfig>();
      categories.forEach(cat => {
        categoriesMap.set(cat.categoryKey.toLowerCase(), cat);
      });

      // 更新全局缓存
      globalCache = {
        categories,
        categoriesMap,
        lastFetch: Date.now(),
      };

      setState({
        categories,
        categoriesMap,
        isLoading: false,
        error: null,
      });

    } catch (error: any) {
      console.error('Failed to fetch category configs:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'カテゴリの取得に失敗しました',
      }));
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 根据categoryKey获取类别信息
  const getCategoryByKey = (categoryKey?: string): CategoryConfig | null => {
    if (!categoryKey) return null;
    return state.categoriesMap.get(categoryKey.toLowerCase()) || null;
  };

  // 获取所有激活的类别
  const getActiveCategories = (): CategoryConfig[] => {
    return state.categories.filter(cat => cat.isActive);
  };

  // 获取按优先级排序的类别
  const getCategoriesByPriority = (): CategoryConfig[] => {
    return [...state.categories].sort((a, b) => b.commercialPriority - a.commercialPriority);
  };

  // 手动刷新缓存
  const refreshCategories = async () => {
    globalCache = null; // 清除缓存
    await fetchCategories();
  };

  return {
    categories: state.categories,
    categoriesMap: state.categoriesMap,
    isLoading: state.isLoading,
    error: state.error,
    getCategoryByKey,
    getActiveCategories,
    getCategoriesByPriority,
    refreshCategories,
  };
};

// 导出单例函数用于非React组件中使用
export const getCategoryConfigByKey = async (categoryKey: string): Promise<CategoryConfig | null> => {
  if (!categoryKey) return null;

  // 检查全局缓存
  if (globalCache && Date.now() - globalCache.lastFetch < CACHE_DURATION) {
    return globalCache.categoriesMap.get(categoryKey.toLowerCase()) || null;
  }

  // 如果缓存失效，重新获取
  try {
    const { data, error } = await supabase
      .from('category_configs')
      .select('*')
      .eq('category_key', categoryKey)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    return {
      categoryKey: data.category_key,
      displayName: data.display_name,
      iconEmoji: data.icon_emoji,
      colorCode: data.color_code,
      commercialPriority: data.commercial_priority,
      isActive: data.is_active,
      sortOrder: data.sort_order,
    };
  } catch (error) {
    console.error('Failed to fetch single category config:', error);
    return null;
  }
};