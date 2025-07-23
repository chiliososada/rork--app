/**
 * 统一的缓存管理器
 * 提供智能缓存失效、请求去重和防抖机制
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  requestKey: string;
  version: number;
}

interface CacheConfig {
  /** 缓存过期时间（毫秒） */
  ttl: number;
  /** 位置变化阈值（米），超过此距离缓存失效 */
  locationThreshold: number;
  /** 请求防抖时间（毫秒） */
  debounceTime: number;
  /** 最大缓存条目数 */
  maxEntries: number;
  /** 是否启用位置相关缓存 */
  locationBased: boolean;
}

interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  requestKey: string;
}

interface RequestDeduplicationResult<T> {
  /** 是否应该执行新请求 */
  shouldRequest: boolean;
  /** 如果不应该请求，返回缓存的数据 */
  cachedData?: T;
  /** 如果有正在进行的请求，返回其 Promise */
  pendingPromise?: Promise<T>;
  /** 清理函数，请求完成后调用 */
  cleanup: () => void;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private lastRequestTimes = new Map<string, number>();
  private configs = new Map<string, CacheConfig>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  private constructor() {
    // 启动定期清理，每30秒清理一次过期缓存
    this.startCleanupInterval();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      if (this.isDestroyed) {
        return;
      }
      
      try {
        this.cleanupExpiredCache();
      } catch (error) {
        console.error('[CacheManager] Cleanup error:', error);
      }
    }, 30000); // 每30秒清理一次
  }

  /**
   * 停止清理并销毁实例
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // 清理所有数据
    this.cache.clear();
    this.pendingRequests.clear();
    this.lastRequestTimes.clear();
    this.configs.clear();
    
    // 重置单例实例
    CacheManager.instance = null as any;
  }

  /**
   * 注册缓存配置
   */
  registerConfig(storeKey: string, config: CacheConfig): void {
    if (this.isDestroyed) {
      console.warn('[CacheManager] Cannot register config on destroyed instance');
      return;
    }
    this.configs.set(storeKey, config);
  }

  /**
   * 计算两点之间的距离（米）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // 地球半径（米）
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
   * 生成请求键
   */
  private generateRequestKey(
    storeKey: string,
    method: string,
    params: Record<string, any>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);

    return `${storeKey}:${method}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(
    entry: CacheEntry,
    config: CacheConfig,
    currentLocation?: { latitude: number; longitude: number }
  ): boolean {
    const now = Date.now();

    // 检查时间过期
    if (now > entry.expiresAt) {
      return false;
    }

    // 检查位置变化（如果启用位置相关缓存）
    if (
      config.locationBased &&
      currentLocation &&
      entry.location &&
      this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        entry.location.latitude,
        entry.location.longitude
      ) > config.locationThreshold
    ) {
      return false;
    }

    return true;
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
    });

    // 清理过期的待处理请求
    const expiredPendingKeys: string[] = [];
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > 30000) { // 30秒超时
        expiredPendingKeys.push(key);
      }
    });

    expiredPendingKeys.forEach(key => {
      this.pendingRequests.delete(key);
    });
  }

  /**
   * 限制缓存大小
   */
  private enforceMaxEntries(config: CacheConfig): void {
    if (this.cache.size <= config.maxEntries) return;

    // 按时间戳排序，删除最旧的条目
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const entriesToDelete = entries.slice(0, this.cache.size - config.maxEntries);
    entriesToDelete.forEach(([key]) => {
      this.cache.delete(key);
    });
  }

  /**
   * 请求去重和防抖检查
   */
  checkRequestDeduplication<T>(
    storeKey: string,
    method: string,
    params: Record<string, any>,
    currentLocation?: { latitude: number; longitude: number }
  ): RequestDeduplicationResult<T> {
    if (this.isDestroyed) {
      return {
        shouldRequest: false,
        cleanup: () => {}
      };
    }

    const config = this.configs.get(storeKey);
    if (!config) {
      throw new Error(`No cache config registered for store: ${storeKey}`);
    }

    const requestKey = this.generateRequestKey(storeKey, method, params);
    const now = Date.now();

    // 清理过期缓存
    this.cleanupExpiredCache();

    // 检查防抖
    const lastRequestTime = this.lastRequestTimes.get(requestKey) || 0;
    if (now - lastRequestTime < config.debounceTime) {
      // 检查是否有缓存数据
      const cachedEntry = this.cache.get(requestKey);
      if (cachedEntry && this.isCacheValid(cachedEntry, config, currentLocation)) {
        return {
          shouldRequest: false,
          cachedData: cachedEntry.data,
          cleanup: () => {}
        };
      }

      // 检查是否有正在进行的请求
      const pendingRequest = this.pendingRequests.get(requestKey);
      if (pendingRequest) {
        return {
          shouldRequest: false,
          pendingPromise: pendingRequest.promise,
          cleanup: () => {}
        };
      }

      // 如果没有缓存且没有正在进行的请求，但在防抖期内，跳过请求
      return {
        shouldRequest: false,
        cleanup: () => {}
      };
    }

    // 检查缓存
    const cachedEntry = this.cache.get(requestKey);
    if (cachedEntry && this.isCacheValid(cachedEntry, config, currentLocation)) {
      return {
        shouldRequest: false,
        cachedData: cachedEntry.data,
        cleanup: () => {}
      };
    }

    // 检查是否有相同的请求正在进行
    const pendingRequest = this.pendingRequests.get(requestKey);
    if (pendingRequest) {
      return {
        shouldRequest: false,
        pendingPromise: pendingRequest.promise,
        cleanup: () => {}
      };
    }

    // 更新最后请求时间
    this.lastRequestTimes.set(requestKey, now);

    // 返回应该执行请求的结果
    return {
      shouldRequest: true,
      cleanup: () => {
        this.pendingRequests.delete(requestKey);
      }
    };
  }

  /**
   * 注册正在进行的请求
   */
  registerPendingRequest<T>(
    storeKey: string,
    method: string,
    params: Record<string, any>,
    promise: Promise<T>
  ): void {
    if (this.isDestroyed) {
      return;
    }

    const requestKey = this.generateRequestKey(storeKey, method, params);
    
    // 确保不会重复注册同一个请求
    if (this.pendingRequests.has(requestKey)) {
      console.warn(`[CacheManager] Request already pending: ${requestKey}`);
      return;
    }

    const pendingRequest: PendingRequest<T> = {
      promise,
      timestamp: Date.now(),
      requestKey
    };

    this.pendingRequests.set(requestKey, pendingRequest);

    // 请求完成后自动清理
    promise
      .finally(() => {
        // 检查是否仍然是同一个请求实例
        const currentPending = this.pendingRequests.get(requestKey);
        if (currentPending === pendingRequest) {
          this.pendingRequests.delete(requestKey);
        }
      })
      .catch(() => {
        // Promise rejection已经由调用者处理，这里只是确保清理
      });
  }

  /**
   * 缓存请求结果
   */
  cacheResult<T>(
    storeKey: string,
    method: string,
    params: Record<string, any>,
    data: T,
    currentLocation?: { latitude: number; longitude: number }
  ): void {
    const config = this.configs.get(storeKey);
    if (!config) return;

    const requestKey = this.generateRequestKey(storeKey, method, params);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + config.ttl,
      location: config.locationBased ? currentLocation : undefined,
      requestKey,
      version: 1
    };

    this.cache.set(requestKey, entry);

    // 限制缓存大小
    this.enforceMaxEntries(config);

    // 清理请求
    this.pendingRequests.delete(requestKey);
  }

  /**
   * 使特定的缓存失效
   */
  invalidateCache(
    storeKey: string,
    method?: string,
    params?: Record<string, any>
  ): void {
    if (method && params) {
      // 使特定请求的缓存失效
      const requestKey = this.generateRequestKey(storeKey, method, params);
      this.cache.delete(requestKey);
      this.lastRequestTimes.delete(requestKey);
    } else if (method) {
      // 使特定方法的所有缓存失效
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(`${storeKey}:${method}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.lastRequestTimes.delete(key);
      });
    } else {
      // 使整个 store 的缓存失效
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(`${storeKey}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.lastRequestTimes.delete(key);
      });
    }
  }

  /**
   * 使所有位置相关的缓存失效
   */
  invalidateLocationBasedCache(): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (entry.location) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(storeKey?: string): {
    totalEntries: number;
    pendingRequests: number;
    cacheHitRate: number;
    averageAge: number;
    locationBasedEntries: number;
    storeBreakdown: Record<string, number>;
  } {
    const now = Date.now();
    let totalEntries = 0;
    let locationBasedEntries = 0;
    let totalAge = 0;
    const storeBreakdown: Record<string, number> = {};

    this.cache.forEach((entry, key) => {
      if (!storeKey || key.startsWith(`${storeKey}:`)) {
        totalEntries++;
        totalAge += now - entry.timestamp;
        
        if (entry.location) {
          locationBasedEntries++;
        }

        const store = key.split(':')[0];
        storeBreakdown[store] = (storeBreakdown[store] || 0) + 1;
      }
    });

    const pendingRequests = storeKey
      ? Array.from(this.pendingRequests.keys()).filter(key => 
          key.startsWith(`${storeKey}:`)).length
      : this.pendingRequests.size;

    return {
      totalEntries,
      pendingRequests,
      cacheHitRate: 0, // This would need to be tracked separately
      averageAge: totalEntries > 0 ? totalAge / totalEntries : 0,
      locationBasedEntries,
      storeBreakdown
    };
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    this.lastRequestTimes.clear();
  }
}

// 导出单例实例
export const cacheManager = CacheManager.getInstance();