/**
 * 全局请求去重系统
 * 确保同一时间内不会有重复的网络请求
 */

interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  controller: AbortController;
  subscribers: Array<{
    resolve: (value: T) => void;
    reject: (error: any) => void;
  }>;
}

interface RequestConfig {
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 是否允许重试 */
  retryable?: boolean;
  /** 重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
}

export class RequestDeduplicator {
  private static instance: RequestDeduplicator;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestStats = new Map<string, {
    count: number;
    successCount: number;
    errorCount: number;
    averageTime: number;
    lastRequestTime: number;
  }>();

  private constructor() {
    // 定期清理超时的请求
    setInterval(() => {
      this.cleanupTimeoutRequests();
    }, 30000); // 每30秒清理一次
  }

  static getInstance(): RequestDeduplicator {
    if (!RequestDeduplicator.instance) {
      RequestDeduplicator.instance = new RequestDeduplicator();
    }
    return RequestDeduplicator.instance;
  }

  /**
   * 生成请求键
   */
  private generateKey(
    url: string,
    method: string = 'GET',
    params: Record<string, any> = {}
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        // 对于位置参数，进行舍入以允许小的位置变化
        if (key === 'latitude' || key === 'longitude') {
          result[key] = Math.round(params[key] * 1000) / 1000; // 精确到3位小数
        } else {
          result[key] = params[key];
        }
        return result;
      }, {} as Record<string, any>);

    return `${method.toUpperCase()}:${url}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * 清理超时的请求
   */
  private cleanupTimeoutRequests(): void {
    const now = Date.now();
    const timeout = 60000; // 60秒超时

    const expiredKeys: string[] = [];
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > timeout) {
        // 取消超时的请求
        request.controller.abort();
        
        // 拒绝所有订阅者
        const timeoutError = new Error('Request timeout');
        request.subscribers.forEach(({ reject }) => {
          reject(timeoutError);
        });

        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.pendingRequests.delete(key);
    });
  }

  /**
   * 更新请求统计
   */
  private updateStats(key: string, success: boolean, duration: number): void {
    const stats = this.requestStats.get(key) || {
      count: 0,
      successCount: 0,
      errorCount: 0,
      averageTime: 0,
      lastRequestTime: 0
    };

    stats.count++;
    stats.lastRequestTime = Date.now();
    
    if (success) {
      stats.successCount++;
    } else {
      stats.errorCount++;
    }

    // 计算平均时间
    stats.averageTime = (stats.averageTime * (stats.count - 1) + duration) / stats.count;

    this.requestStats.set(key, stats);
  }

  /**
   * 执行去重请求
   */
  async deduplicatedRequest<T>(
    requestFn: (signal: AbortSignal) => Promise<T>,
    key: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const {
      timeout = 30000,
      retryable = false,
      maxRetries = 3,
      retryDelay = 1000
    } = config;

    // 检查是否有相同的请求正在进行
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      // 返回一个新的 Promise，当现有请求完成时解析
      return new Promise<T>((resolve, reject) => {
        existingRequest.subscribers.push({ resolve, reject });
      });
    }

    // 创建新的请求
    const controller = new AbortController();
    const startTime = Date.now();

    const executeRequest = async (retryCount = 0): Promise<T> => {
      try {
        // 设置超时
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        const result = await requestFn(controller.signal);
        
        clearTimeout(timeoutId);
        
        // 更新统计
        this.updateStats(key, true, Date.now() - startTime);
        
        return result;
      } catch (error: any) {
        // 如果是取消错误，直接抛出
        if (error.name === 'AbortError') {
          throw error;
        }

        // 更新统计
        this.updateStats(key, false, Date.now() - startTime);

        // 如果允许重试且还有重试次数
        if (retryable && retryCount < maxRetries) {
          console.warn(`Request failed, retrying in ${retryDelay}ms (${retryCount + 1}/${maxRetries}):`, error);
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return executeRequest(retryCount + 1);
        }

        throw error;
      }
    };

    const pendingRequest: PendingRequest<T> = {
      promise: executeRequest(),
      timestamp: Date.now(),
      controller,
      subscribers: []
    };

    this.pendingRequests.set(key, pendingRequest);

    try {
      const result = await pendingRequest.promise;

      // 通知所有订阅者
      pendingRequest.subscribers.forEach(({ resolve }) => {
        resolve(result);
      });

      return result;
    } catch (error) {
      // 通知所有订阅者错误
      pendingRequest.subscribers.forEach(({ reject }) => {
        reject(error);
      });

      throw error;
    } finally {
      // 清理请求
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Supabase 查询去重包装器
   */
  async deduplicatedQuery<T>(
    queryBuilder: any,
    identifier: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const key = this.generateKey(identifier, 'QUERY', params);

    return this.deduplicatedRequest<T>(
      async (signal) => {
        // 将 AbortSignal 添加到查询中（如果 Supabase 支持）
        const { data, error } = await queryBuilder;
        
        if (error) {
          throw error;
        }
        
        return data;
      },
      key,
      {
        timeout: 15000, // 15秒超时
        retryable: true,
        maxRetries: 2,
        retryDelay: 1000
      }
    );
  }

  /**
   * HTTP 请求去重包装器
   */
  async deduplicatedFetch<T>(
    url: string,
    options: RequestInit = {},
    params: Record<string, any> = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const key = this.generateKey(url, method, params);

    return this.deduplicatedRequest<T>(
      async (signal) => {
        const response = await fetch(url, {
          ...options,
          signal
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      },
      key,
      {
        timeout: 10000, // 10秒超时
        retryable: method === 'GET',
        maxRetries: 2,
        retryDelay: 1000
      }
    );
  }

  /**
   * 取消特定的请求
   */
  cancelRequest(key: string): boolean {
    const request = this.pendingRequests.get(key);
    if (request) {
      request.controller.abort();
      
      // 通知订阅者
      const cancelError = new Error('Request cancelled');
      request.subscribers.forEach(({ reject }) => {
        reject(cancelError);
      });

      this.pendingRequests.delete(key);
      return true;
    }
    return false;
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    this.pendingRequests.forEach((request, key) => {
      request.controller.abort();
      
      const cancelError = new Error('All requests cancelled');
      request.subscribers.forEach(({ reject }) => {
        reject(cancelError);
      });
    });

    this.pendingRequests.clear();
  }

  /**
   * 获取请求统计信息
   */
  getRequestStats(): {
    pendingRequests: number;
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    topRequests: Array<{
      key: string;
      count: number;
      successRate: number;
      averageTime: number;
    }>;
  } {
    const totalRequests = Array.from(this.requestStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);
    
    const totalSuccess = Array.from(this.requestStats.values())
      .reduce((sum, stats) => sum + stats.successCount, 0);
    
    const totalTime = Array.from(this.requestStats.values())
      .reduce((sum, stats) => sum + (stats.averageTime * stats.count), 0);

    const topRequests = Array.from(this.requestStats.entries())
      .map(([key, stats]) => ({
        key,
        count: stats.count,
        successRate: stats.count > 0 ? stats.successCount / stats.count : 0,
        averageTime: stats.averageTime
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      pendingRequests: this.pendingRequests.size,
      totalRequests,
      successRate: totalRequests > 0 ? totalSuccess / totalRequests : 0,
      averageResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0,
      topRequests
    };
  }

  /**
   * 清理统计数据
   */
  clearStats(): void {
    this.requestStats.clear();
  }
}

// 导出单例实例
export const requestDeduplicator = RequestDeduplicator.getInstance();