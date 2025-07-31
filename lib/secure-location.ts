/**
 * セキュアな位置情報管理システム
 * プライバシー保護のための位置情報ファジング機能付き
 */
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FuzzedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  isExact?: boolean; // 正確な位置かファジングされた位置か
}

export interface LocationPrivacySettings {
  enableFuzzing: boolean;
  fuzzingRadius: number; // メートル単位
  shareExactLocation: boolean;
  allowLocationSharing: boolean;
}

// デフォルトのプライバシー設定
const DEFAULT_PRIVACY_SETTINGS: LocationPrivacySettings = {
  enableFuzzing: true,
  fuzzingRadius: 200, // 200m以内でランダム化
  shareExactLocation: false,
  allowLocationSharing: true
};

class SecureLocationService {
  private static instance: SecureLocationService;
  private privacySettings: LocationPrivacySettings;
  private locationCache: Map<string, { location: FuzzedLocation; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分間キャッシュ

  private constructor() {
    this.privacySettings = DEFAULT_PRIVACY_SETTINGS;
    this.loadPrivacySettings();
  }

  public static getInstance(): SecureLocationService {
    if (!SecureLocationService.instance) {
      SecureLocationService.instance = new SecureLocationService();
    }
    return SecureLocationService.instance;
  }

  /**
   * プライバシー設定の読み込み
   */
  private async loadPrivacySettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('location-privacy-settings');
      if (stored) {
        this.privacySettings = { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('位置情報プライバシー設定の読み込みに失敗:', error);
    }
  }

  /**
   * プライバシー設定の保存
   */
  private async savePrivacySettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('location-privacy-settings', JSON.stringify(this.privacySettings));
    } catch (error) {
      console.error('位置情報プライバシー設定の保存に失敗:', error);
    }
  }

  /**
   * 位置情報にファジングを適用
   * @param location 元の位置情報
   * @param radiusMeters ファジング半径（メートル）
   * @returns ファジングされた位置情報
   */
  private fuzzLocation(location: Location.LocationObject, radiusMeters: number): FuzzedLocation {
    if (!this.privacySettings.enableFuzzing || radiusMeters === 0) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
        isExact: true
      };
    }

    // ランダムな角度と距離を生成
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusMeters;

    // 地球の半径（メートル）
    const earthRadius = 6371000;

    // 緯度の変位を計算
    const deltaLat = (distance * Math.cos(angle)) / earthRadius;
    const deltaLng = (distance * Math.sin(angle)) / (earthRadius * Math.cos(location.coords.latitude * Math.PI / 180));

    // ファジングされた座標を計算
    const fuzzedLatitude = location.coords.latitude + (deltaLat * 180 / Math.PI);
    const fuzzedLongitude = location.coords.longitude + (deltaLng * 180 / Math.PI);

    return {
      latitude: fuzzedLatitude,
      longitude: fuzzedLongitude,
      accuracy: Math.max((location.coords.accuracy || 0) + radiusMeters, radiusMeters),
      timestamp: location.timestamp,
      isExact: false
    };
  }

  /**
   * 安全な位置情報の取得
   * @param forceRefresh キャッシュを無視して新しい位置を取得
   * @returns ファジングされた位置情報
   */
  public async getSecureLocation(forceRefresh: boolean = false): Promise<FuzzedLocation | null> {
    try {
      // 位置情報共有が無効の場合
      if (!this.privacySettings.allowLocationSharing) {
        console.log('位置情報の共有が無効になっています');
        return null;
      }

      // キャッシュをチェック
      const cacheKey = 'current_location';
      if (!forceRefresh && this.locationCache.has(cacheKey)) {
        const cached = this.locationCache.get(cacheKey)!;
        if (Date.now() < cached.expiry) {
          return cached.location;
        }
      }

      // 位置情報の権限を確認
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('位置情報の権限が拒否されました');
          return null;
        }
      }

      // 現在位置を取得
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10
      });

      // ファジングを適用
      const fuzzedLocation = this.fuzzLocation(location, this.privacySettings.fuzzingRadius);

      // キャッシュに保存
      this.locationCache.set(cacheKey, {
        location: fuzzedLocation,
        expiry: Date.now() + this.CACHE_DURATION
      });

      return fuzzedLocation;

    } catch (error) {
      console.error('安全な位置情報の取得に失敗:', error);
      return null;
    }
  }

  /**
   * 正確な位置情報の取得（ユーザーが明示的に許可した場合のみ）
   * @returns 正確な位置情報
   */
  public async getExactLocation(): Promise<FuzzedLocation | null> {
    if (!this.privacySettings.shareExactLocation) {
      console.log('正確な位置情報の共有が無効になっています');
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
        isExact: true
      };

    } catch (error) {
      console.error('正確な位置情報の取得に失敗:', error);
      return null;
    }
  }

  /**
   * 話題作成用の位置情報取得（より高精度、ただしファジング適用）
   */
  public async getLocationForTopicCreation(): Promise<FuzzedLocation | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000
      });

      // 話題作成時は少し狭いファジング範囲を使用（50-100m）
      const topicFuzzingRadius = Math.min(this.privacySettings.fuzzingRadius, 100);
      return this.fuzzLocation(location, topicFuzzingRadius);

    } catch (error) {
      console.error('話題作成用位置情報の取得に失敗:', error);
      return null;
    }
  }

  /**
   * 検索用の位置情報取得（広範囲のファジング適用）
   */
  public async getLocationForSearch(): Promise<FuzzedLocation | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      // 検索時はより広いファジング範囲を使用（200-500m）
      const searchFuzzingRadius = Math.max(this.privacySettings.fuzzingRadius, 200);
      return this.fuzzLocation(location, searchFuzzingRadius);

    } catch (error) {
      console.error('検索用位置情報の取得に失敗:', error);
      return null;
    }
  }

  /**
   * プライバシー設定の更新
   */
  public async updatePrivacySettings(settings: Partial<LocationPrivacySettings>): Promise<void> {
    this.privacySettings = { ...this.privacySettings, ...settings };
    await this.savePrivacySettings();
    
    // キャッシュをクリア（設定変更により無効になるため）
    this.locationCache.clear();
  }

  /**
   * 現在のプライバシー設定を取得
   */
  public getPrivacySettings(): LocationPrivacySettings {
    return { ...this.privacySettings };
  }

  /**
   * 位置情報キャッシュのクリア
   */
  public clearLocationCache(): void {
    this.locationCache.clear();
  }

  /**
   * 2つの位置間の距離を計算（Haversine公式）
   * @param loc1 位置1
   * @param loc2 位置2
   * @returns 距離（メートル）
   */
  public static calculateDistance(
    loc1: { latitude: number; longitude: number },
    loc2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // 地球の半径（メートル）
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 位置情報の精度レベルを取得
   */
  public getLocationAccuracyLevel(location: FuzzedLocation): 'high' | 'medium' | 'low' {
    if (location.isExact) {
      return 'high';
    }
    
    const accuracy = location.accuracy || this.privacySettings.fuzzingRadius;
    if (accuracy <= 100) return 'high';
    if (accuracy <= 300) return 'medium';
    return 'low';
  }

  /**
   * デバッグ情報の取得
   */
  public getDebugInfo(): {
    privacySettings: LocationPrivacySettings;
    cacheSize: number;
    cacheEntries: string[];
  } {
    return {
      privacySettings: this.privacySettings,
      cacheSize: this.locationCache.size,
      cacheEntries: Array.from(this.locationCache.keys())
    };
  }
}

// シングルトンインスタンスをエクスポート
export const secureLocationService = SecureLocationService.getInstance();

// ユーティリティ関数のエクスポート
export const LocationUtils = {
  calculateDistance: SecureLocationService.calculateDistance,
  
  /**
   * 位置情報が有効かどうかを判定
   */
  isValidLocation: (location: FuzzedLocation | null): location is FuzzedLocation => {
    return location !== null && 
           typeof location.latitude === 'number' && 
           typeof location.longitude === 'number' &&
           !isNaN(location.latitude) && 
           !isNaN(location.longitude) &&
           Math.abs(location.latitude) <= 90 && 
           Math.abs(location.longitude) <= 180;
  },

  /**
   * 位置情報を人間が読める文字列に変換
   */
  formatLocation: (location: FuzzedLocation, includeAccuracy: boolean = false): string => {
    const lat = location.latitude.toFixed(6);
    const lng = location.longitude.toFixed(6);
    const accuracy = includeAccuracy && location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : '';
    const fuzzing = location.isExact ? ' [exact]' : ' [fuzzed]';
    return `${lat}, ${lng}${accuracy}${fuzzing}`;
  }
};