import { cacheManager } from './cache-manager';

/**
 * Store 基类，提供统一的缓存策略
 */
export abstract class BaseStore {
  protected storeKey: string;
  protected currentLocation?: { latitude: number; longitude: number };

  constructor(storeKey: string) {
    this.storeKey = storeKey;
    this.initializeCache();
  }

  /**
   * 初始化缓存配置 - 子类必须实现
   */
  protected abstract initializeCache(): void;

  /**
   * 更新当前位置
   */
  protected updateCurrentLocation(location: { latitude: number; longitude: number }): void {
    const oldLocation = this.currentLocation;
    this.currentLocation = location;

    // 如果位置发生显著变化，使位置相关的缓存失效
    if (oldLocation && this.calculateDistance(
      oldLocation.latitude,
      oldLocation.longitude,
      location.latitude,
      location.longitude
    ) > 1000) { // 1km 阈值
      cacheManager.invalidateLocationBasedCache();
    }
  }

  /**
   * 计算距离
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 执行带缓存的请求
   */
  protected async executeWithCache<T>(
    method: string,
    params: Record<string, any>,
    requestFn: () => Promise<T>
  ): Promise<T | undefined> {
    const deduplicationResult = cacheManager.checkRequestDeduplication<T>(
      this.storeKey,
      method,
      params,
      this.currentLocation
    );

    try {
      // 如果不应该请求，返回缓存数据或等待正在进行的请求
      if (!deduplicationResult.shouldRequest) {
        if (deduplicationResult.cachedData !== undefined) {
          return deduplicationResult.cachedData;
        }
        
        if (deduplicationResult.pendingPromise) {
          return await deduplicationResult.pendingPromise;
        }
        
        // 在防抖期内，不执行请求
        return undefined;
      }

      // 执行新请求
      const promise = requestFn();
      
      // 注册正在进行的请求
      cacheManager.registerPendingRequest(this.storeKey, method, params, promise);

      // 等待请求完成
      const result = await promise;

      // 缓存结果
      cacheManager.cacheResult(
        this.storeKey,
        method,
        params,
        result,
        this.currentLocation
      );

      return result;
    } catch (error) {
      console.error(`[${this.storeKey}] Request failed for method ${method}:`, error);
      throw error;
    } finally {
      // 清理
      deduplicationResult.cleanup();
    }
  }

  /**
   * 使特定方法的缓存失效
   */
  protected invalidateCache(method?: string, params?: Record<string, any>): void {
    cacheManager.invalidateCache(this.storeKey, method, params);
  }

  /**
   * 获取缓存统计信息
   */
  protected getCacheStats() {
    return cacheManager.getCacheStats(this.storeKey);
  }
}

/**
 * 缓存配置预设
 */
export const CACHE_PRESETS = {
  // 短期缓存 - 用于频繁更新的数据
  SHORT_TERM: {
    ttl: 2 * 60 * 1000, // 2分钟
    locationThreshold: 500, // 500米
    debounceTime: 1000, // 1秒
    maxEntries: 50,
    locationBased: true
  },

  // 中期缓存 - 用于中等频率更新的数据
  MEDIUM_TERM: {
    ttl: 10 * 60 * 1000, // 10分钟
    locationThreshold: 1000, // 1公里
    debounceTime: 2000, // 2秒
    maxEntries: 100,
    locationBased: true
  },

  // 长期缓存 - 用于很少更新的数据
  LONG_TERM: {
    ttl: 60 * 60 * 1000, // 1小时
    locationThreshold: 5000, // 5公里
    debounceTime: 5000, // 5秒
    maxEntries: 200,
    locationBased: true
  },

  // 非位置相关缓存
  NON_LOCATION: {
    ttl: 30 * 60 * 1000, // 30分钟
    locationThreshold: 0,
    debounceTime: 1000, // 1秒
    maxEntries: 100,
    locationBased: false
  },

  // 用户相关缓存
  USER_DATA: {
    ttl: 15 * 60 * 1000, // 15分钟
    locationThreshold: 0,
    debounceTime: 500, // 500ms
    maxEntries: 50,
    locationBased: false
  }
} as const;