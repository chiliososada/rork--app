import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TimeRange = 'today' | 'week' | 'month' | 'all';

export interface SearchSettings {
  radiusKm: number; // 検索半径（km）
  timeRange: TimeRange; // 時間範囲
}

interface SearchSettingsState {
  settings: SearchSettings;
  updateRadius: (radiusKm: number) => void;
  updateTimeRange: (timeRange: TimeRange) => void;
  updateSettings: (settings: Partial<SearchSettings>) => void;
  resetToDefaults: () => void;
}

// デフォルト設定
const DEFAULT_SETTINGS: SearchSettings = {
  radiusKm: 5,
  timeRange: 'all'
};

export const useSearchSettingsStore = create<SearchSettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,

      updateRadius: (radiusKm: number) => {
        // 範囲チェック（1-50km）
        const clampedRadius = Math.max(1, Math.min(50, radiusKm));
        set(state => ({
          settings: {
            ...state.settings,
            radiusKm: clampedRadius
          }
        }));
      },

      updateTimeRange: (timeRange: TimeRange) => {
        set(state => ({
          settings: {
            ...state.settings,
            timeRange
          }
        }));
      },

      updateSettings: (newSettings: Partial<SearchSettings>) => {
        set(state => ({
          settings: {
            ...state.settings,
            ...newSettings
          }
        }));
      },

      resetToDefaults: () => {
        set({ settings: { ...DEFAULT_SETTINGS } });
      }
    }),
    {
      name: 'search-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ settings: state.settings })
    }
  )
);

// 時間範囲の日本語表示用ヘルパー
export const getTimeRangeLabel = (timeRange: TimeRange): string => {
  switch (timeRange) {
    case 'today':
      return '今日';
    case 'week':
      return '過去1週間';
    case 'month':
      return '過去1ヶ月';
    case 'all':
      return 'すべて';
    default:
      return 'すべて';
  }
};

// 半径の日本語表示用ヘルパー
export const getRadiusLabel = (radiusKm: number): string => {
  return `半径${radiusKm}km`;
};