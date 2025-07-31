import { create } from 'zustand';
import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';
import { secureLocationService, FuzzedLocation, LocationPrivacySettings, LocationUtils } from '@/lib/secure-location';

// Define our own Location type to avoid conflicts
interface AppLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  isExact?: boolean;
  accuracy?: number;
  timestamp?: number;
}

interface LocationState {
  currentLocation: AppLocation | null;
  selectedLocation: AppLocation | null;
  permissionStatus: ExpoLocation.PermissionStatus | null;
  isLoading: boolean;
  error: string | null;
  privacySettings: LocationPrivacySettings;
  
  // 既存のメソッド
  requestPermission: () => Promise<void>;
  getCurrentLocation: () => Promise<AppLocation | null>;
  setSelectedLocation: (location: AppLocation) => void;
  clearSelectedLocation: () => void;
  reverseGeocode: (location: { latitude: number; longitude: number }) => Promise<AppLocation>;
  getDetailedLocationInfo: (location: { latitude: number; longitude: number }) => Promise<{
    areaName: string | null;
    cityName: string | null;
    regionName: string | null;
    countryName: string | null;
  }>;
  
  // セキュアな位置情報関連のメソッド
  getSecureLocation: (forceRefresh?: boolean) => Promise<AppLocation | null>;
  getLocationForTopicCreation: () => Promise<AppLocation | null>;
  getLocationForSearch: () => Promise<AppLocation | null>;
  getExactLocation: () => Promise<AppLocation | null>;
  updatePrivacySettings: (settings: Partial<LocationPrivacySettings>) => Promise<void>;
  clearLocationCache: () => void;
  calculateDistance: (loc1: { latitude: number; longitude: number }, loc2: { latitude: number; longitude: number }) => number;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  selectedLocation: null,
  permissionStatus: null,
  isLoading: false,
  error: null,
  privacySettings: secureLocationService.getPrivacySettings(),

  requestPermission: async () => {
    set({ isLoading: true, error: null });
    
    try {
      if (Platform.OS === 'web') {
        // Web implementation
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        set({
          permissionStatus: 'granted' as ExpoLocation.PermissionStatus,
          isLoading: false,
        });
        
        // セキュアな位置情報を取得
        await get().getSecureLocation(true);
        return;
      }
      
      // Native implementation
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      set({ permissionStatus: status });
      
      if (status !== 'granted') {
        set({ 
          error: "位置情報のアクセス許可が拒否されました", 
          isLoading: false 
        });
        return;
      }
      
      // セキュアな位置情報を取得
      await get().getSecureLocation(true);
    } catch (error) {
      set({ 
        error: "位置情報の許可取得に失敗しました", 
        isLoading: false 
      });
    }
  },

  getCurrentLocation: async () => {
    // セキュアな位置情報サービスを使用
    return get().getSecureLocation(true);
  },

  setSelectedLocation: (location) => {
    set({ selectedLocation: location });
  },

  clearSelectedLocation: () => {
    set({ selectedLocation: null });
  },

  reverseGeocode: async (location: { latitude: number; longitude: number }): Promise<AppLocation> => {
    try {
      if (Platform.OS === 'web') {
        // Web implementation using a reverse geocoding API
        // For now, return the location with a generic name
        return {
          ...location,
          name: '現在地',
          address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        };
      }
      
      // Native implementation using Expo Location reverse geocoding
      const reverseGeocodeResult = await ExpoLocation.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      
      if (reverseGeocodeResult && reverseGeocodeResult.length > 0) {
        const result = reverseGeocodeResult[0];
        
        // Build a readable location name
        const nameParts = [];
        if (result.district) nameParts.push(result.district);
        if (result.city) nameParts.push(result.city);
        if (result.region) nameParts.push(result.region);
        
        const name = nameParts.length > 0 ? nameParts.join(', ') : '現在地';
        
        // Build full address
        const addressParts = [];
        if (result.name) addressParts.push(result.name);
        if (result.street) addressParts.push(result.street);
        if (result.district) addressParts.push(result.district);
        if (result.city) addressParts.push(result.city);
        if (result.region) addressParts.push(result.region);
        if (result.country) addressParts.push(result.country);
        
        const address = addressParts.length > 0 ? addressParts.join(', ') : name;
        
        return {
          ...location,
          name,
          address
        };
      }
      
      // Fallback if reverse geocoding fails
      return {
        ...location,
        name: '現在地',
        address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      
      // Return location with fallback name
      return {
        ...location,
        name: '現在地',
        address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      };
    }
  },

  // 詳細な地域情報を取得する新しいメソッド
  getDetailedLocationInfo: async (location: { latitude: number; longitude: number }) => {
    try {
      if (Platform.OS === 'web') {
        // Web では簡易的な情報のみ
        return {
          areaName: null,
          cityName: null,
          regionName: null,
          countryName: null,
        };
      }
      
      const reverseGeocodeResult = await ExpoLocation.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      
      if (reverseGeocodeResult && reverseGeocodeResult.length > 0) {
        const result = reverseGeocodeResult[0];
        
        return {
          areaName: result.district || result.subregion || null,
          cityName: result.city || result.region || null,
          regionName: result.region || result.subregion || null,
          countryName: result.country || null,
        };
      }
      
      return {
        areaName: null,
        cityName: null,
        regionName: null,
        countryName: null,
      };
    } catch (error) {
      console.error('Failed to get detailed location info:', error);
      return {
        areaName: null,
        cityName: null,
        regionName: null,
        countryName: null,
      };
    }
  },
  
  // セキュアな位置情報の取得
  getSecureLocation: async (forceRefresh: boolean = false) => {
    set({ isLoading: true, error: null });
    
    try {
      const fuzzedLocation = await secureLocationService.getSecureLocation(forceRefresh);
      
      if (!fuzzedLocation) {
        set({ 
          error: "位置情報の取得に失敗しました", 
          isLoading: false 
        });
        return null;
      }
      
      // 逆ジオコーディングで場所名を取得
      const locationWithName = await get().reverseGeocode(fuzzedLocation);
      const appLocation: AppLocation = {
        ...locationWithName,
        isExact: fuzzedLocation.isExact,
        accuracy: fuzzedLocation.accuracy,
        timestamp: fuzzedLocation.timestamp
      };
      
      set({
        currentLocation: appLocation,
        isLoading: false,
      });
      
      return appLocation;
    } catch (error) {
      console.error('セキュアな位置情報の取得に失敗:', error);
      set({ 
        error: "位置情報の取得に失敗しました", 
        isLoading: false 
      });
      return null;
    }
  },
  
  // 話題作成用の位置情報取得
  getLocationForTopicCreation: async () => {
    try {
      const fuzzedLocation = await secureLocationService.getLocationForTopicCreation();
      
      if (!fuzzedLocation) {
        return null;
      }
      
      const locationWithName = await get().reverseGeocode(fuzzedLocation);
      return {
        ...locationWithName,
        isExact: fuzzedLocation.isExact,
        accuracy: fuzzedLocation.accuracy,
        timestamp: fuzzedLocation.timestamp
      };
    } catch (error) {
      console.error('話題作成用位置情報の取得に失敗:', error);
      return null;
    }
  },
  
  // 検索用の位置情報取得
  getLocationForSearch: async () => {
    try {
      const fuzzedLocation = await secureLocationService.getLocationForSearch();
      
      if (!fuzzedLocation) {
        return null;
      }
      
      const locationWithName = await get().reverseGeocode(fuzzedLocation);
      return {
        ...locationWithName,
        isExact: fuzzedLocation.isExact,
        accuracy: fuzzedLocation.accuracy,
        timestamp: fuzzedLocation.timestamp
      };
    } catch (error) {
      console.error('検索用位置情報の取得に失敗:', error);
      return null;
    }
  },
  
  // 正確な位置情報の取得（ユーザーが明示的に許可した場合のみ）
  getExactLocation: async () => {
    try {
      const exactLocation = await secureLocationService.getExactLocation();
      
      if (!exactLocation) {
        return null;
      }
      
      const locationWithName = await get().reverseGeocode(exactLocation);
      return {
        ...locationWithName,
        isExact: exactLocation.isExact,
        accuracy: exactLocation.accuracy,
        timestamp: exactLocation.timestamp
      };
    } catch (error) {
      console.error('正確な位置情報の取得に失敗:', error);
      return null;
    }
  },
  
  // プライバシー設定の更新
  updatePrivacySettings: async (settings: Partial<LocationPrivacySettings>) => {
    try {
      await secureLocationService.updatePrivacySettings(settings);
      set({ privacySettings: secureLocationService.getPrivacySettings() });
    } catch (error) {
      console.error('プライバシー設定の更新に失敗:', error);
      set({ error: "プライバシー設定の更新に失敗しました" });
    }
  },
  
  // 位置情報キャッシュのクリア
  clearLocationCache: () => {
    secureLocationService.clearLocationCache();
  },
  
  // 距離計算
  calculateDistance: (loc1, loc2) => {
    return LocationUtils.calculateDistance(loc1, loc2);
  },
}));