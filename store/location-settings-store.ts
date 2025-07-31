import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type LocationPrecision = 'exact' | 'area' | 'city' | 'hidden';

interface LocationSettings {
  isLocationVisible: boolean;
  saveLocationHistory: boolean;
  locationPrecision: LocationPrecision;
}

interface LocationSettingsState extends LocationSettings {
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: (userId: string) => Promise<void>;
  updateSettings: (settings: Partial<LocationSettings>, userId: string) => Promise<void>;
  clearLocationHistory: (userId: string) => Promise<{ success: boolean; deletedCount: number }>;
  resetSettings: () => void;
  getLocationPrecisionLabel: () => string;
}

const STORAGE_KEY = 'location-settings';

const defaultSettings: LocationSettings = {
  isLocationVisible: true,
  saveLocationHistory: true,
  locationPrecision: 'exact',
};

export const useLocationSettingsStore = create<LocationSettingsState>((set, get) => ({
  ...defaultSettings,
  isLoading: false,
  error: null,

  loadSettings: async (userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // まずローカルストレージから読み込み（高速化のため）
      const cachedSettings = await AsyncStorage.getItem(STORAGE_KEY);
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        set({ ...parsed, isLoading: true }); // キャッシュを適用しつつ、DBからも読み込む
      }

      // データベースから最新の設定を取得
      const { data, error } = await supabase
        .rpc('get_user_location_settings', { user_id_param: userId });

      if (error) throw error;

      if (data && data.length > 0) {
        const settings = data[0];
        const newState: Partial<LocationSettingsState> = {
          isLocationVisible: settings.is_location_visible ?? true,
          saveLocationHistory: settings.save_location_history ?? true,
          locationPrecision: settings.location_precision ?? 'exact',
          isLoading: false,
        };

        set(newState);

        // ローカルストレージに保存
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          isLocationVisible: newState.isLocationVisible,
          saveLocationHistory: newState.saveLocationHistory,
          locationPrecision: newState.locationPrecision,
        }));
      } else {
        // データがない場合はデフォルト設定を使用
        set({ ...defaultSettings, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load location settings:', error);
      set({ 
        error: '位置情報設定の読み込みに失敗しました', 
        isLoading: false 
      });
    }
  },

  updateSettings: async (settings: Partial<LocationSettings>, userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const currentState = get();
      const newSettings = {
        isLocationVisible: settings.isLocationVisible ?? currentState.isLocationVisible,
        saveLocationHistory: settings.saveLocationHistory ?? currentState.saveLocationHistory,
        locationPrecision: settings.locationPrecision ?? currentState.locationPrecision,
      };

      // データベースに保存
      const { data, error } = await supabase
        .rpc('update_location_privacy_settings', {
          user_id_param: userId,
          is_location_visible_param: newSettings.isLocationVisible,
          save_location_history_param: newSettings.saveLocationHistory,
          location_precision_param: newSettings.locationPrecision,
        });

      if (error) throw error;

      if (data && data[0]?.success) {
        // 状態を更新
        set({ ...newSettings, isLoading: false });

        // ローカルストレージに保存
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } else {
        throw new Error(data?.[0]?.message || '設定の更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update location settings:', error);
      set({ 
        error: '位置情報設定の更新に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },

  clearLocationHistory: async (userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .rpc('delete_location_history', {
          user_id_param: userId,
          delete_all: true,
        });

      if (error) throw error;

      set({ isLoading: false });
      
      return {
        success: data?.[0]?.success ?? false,
        deletedCount: data?.[0]?.deleted_count ?? 0,
      };
    } catch (error) {
      console.error('Failed to clear location history:', error);
      set({ 
        error: '位置情報履歴の削除に失敗しました', 
        isLoading: false 
      });
      return { success: false, deletedCount: 0 };
    }
  },

  resetSettings: () => {
    set({ ...defaultSettings, isLoading: false, error: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch(console.error);
  },

  getLocationPrecisionLabel: () => {
    const { locationPrecision } = get();
    switch (locationPrecision) {
      case 'exact':
        return '正確な位置';
      case 'area':
        return 'エリア';
      case 'city':
        return '市区町村';
      case 'hidden':
        return '非表示';
      default:
        return '正確な位置';
    }
  },
}));

// 位置情報の曖昧化ヘルパー関数
export function obfuscateLocation(
  latitude: number, 
  longitude: number, 
  precision: LocationPrecision
): { latitude: number; longitude: number } {
  switch (precision) {
    case 'exact':
      return { latitude, longitude };
    
    case 'area':
      // エリアレベル（約1km四方）に曖昧化
      return {
        latitude: Math.round(latitude * 100) / 100,
        longitude: Math.round(longitude * 100) / 100,
      };
    
    case 'city':
      // 市レベル（約10km四方）に曖昧化
      return {
        latitude: Math.round(latitude * 10) / 10,
        longitude: Math.round(longitude * 10) / 10,
      };
    
    case 'hidden':
    default:
      // 位置情報を完全に隠す（nullまたはデフォルト値を返す）
      return { latitude: 0, longitude: 0 };
  }
}

// 位置情報の精度レベルを日本語で取得
export function getLocationPrecisionLabel(precision: LocationPrecision): string {
  switch (precision) {
    case 'exact':
      return '正確な位置';
    case 'area':
      return 'エリアレベル';
    case 'city':
      return '市レベル';
    case 'hidden':
      return '非表示';
    default:
      return '不明';
  }
}

// 位置情報の表示テキストを生成
export function getLocationDisplayText(
  locationName: string | null,
  precision: LocationPrecision,
  isOwner: boolean = false
): string {
  if (isOwner) {
    // 自分の投稿は常に正確な位置を表示
    return locationName || '位置情報';
  }

  switch (precision) {
    case 'exact':
      return locationName || '位置情報';
    case 'area':
      return `${locationName ? locationName.split(',')[0] : ''}周辺`;
    case 'city':
      return `${locationName ? locationName.split(',')[0] : ''}市内`;
    case 'hidden':
      return '位置情報非公開';
    default:
      return '位置情報';
  }
}