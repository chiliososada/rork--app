/**
 * 全局清理管理器
 * 统一管理应用中所有需要清理的资源
 */

import { cacheManager } from './cache-manager';
import { requestDeduplicator } from './request-deduplicator';

interface CleanupFunction {
  name: string;
  cleanup: () => void;
  priority: 'high' | 'medium' | 'low';
}

export class CleanupManager {
  private static instance: CleanupManager;
  private cleanupFunctions: CleanupFunction[] = [];
  private isDestroyed = false;

  private constructor() {
    // 注册默认的清理函数
    this.registerDefaultCleanups();
    
    // 监听页面卸载事件
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.performCleanup();
      });
      
      // React Native 环境下的清理
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('unload', () => {
          this.performCleanup();
        });
      }
    }
  }

  static getInstance(): CleanupManager {
    if (!CleanupManager.instance) {
      CleanupManager.instance = new CleanupManager();
    }
    return CleanupManager.instance;
  }

  /**
   * 注册清理函数
   */
  registerCleanup(name: string, cleanup: () => void, priority: 'high' | 'medium' | 'low' = 'medium'): () => void {
    if (this.isDestroyed) {
      console.warn('[CleanupManager] Cannot register cleanup on destroyed instance');
      return () => {};
    }

    const cleanupFunction: CleanupFunction = { name, cleanup, priority };
    this.cleanupFunctions.push(cleanupFunction);

    // 返回取消注册函数
    return () => {
      const index = this.cleanupFunctions.indexOf(cleanupFunction);
      if (index > -1) {
        this.cleanupFunctions.splice(index, 1);
      }
    };
  }

  /**
   * 注册默认清理函数
   */
  private registerDefaultCleanups(): void {
    // Cache Manager 清理
    this.registerCleanup('CacheManager', () => {
      try {
        cacheManager.destroy();
      } catch (error) {
        console.error('[CleanupManager] Error cleaning up CacheManager:', error);
      }
    }, 'high');

    // Request Deduplicator 清理
    this.registerCleanup('RequestDeduplicator', () => {
      try {
        requestDeduplicator.destroy();
      } catch (error) {
        console.error('[CleanupManager] Error cleaning up RequestDeduplicator:', error);
      }
    }, 'high');
  }

  /**
   * 执行所有清理操作
   */
  performCleanup(): void {
    if (this.isDestroyed) {
      return;
    }

    console.log('[CleanupManager] Starting cleanup process...');

    // 按优先级排序：high -> medium -> low
    const sortedCleanups = [...this.cleanupFunctions].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // 执行清理
    const results: { name: string; success: boolean; error?: Error }[] = [];
    
    for (const { name, cleanup } of sortedCleanups) {
      try {
        cleanup();
        results.push({ name, success: true });
        console.log(`[CleanupManager] Successfully cleaned up: ${name}`);
      } catch (error) {
        results.push({ name, success: false, error: error as Error });
        console.error(`[CleanupManager] Failed to cleanup: ${name}`, error);
      }
    }

    // 输出清理摘要
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[CleanupManager] Cleanup completed: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.warn('[CleanupManager] Failed cleanups:', results.filter(r => !r.success));
    }

    this.isDestroyed = true;
  }

  /**
   * 获取注册的清理函数信息
   */
  getCleanupInfo(): { name: string; priority: string }[] {
    return this.cleanupFunctions.map(({ name, priority }) => ({ name, priority }));
  }

  /**
   * 手动触发特定清理函数
   */
  triggerCleanup(name: string): boolean {
    const cleanupFunction = this.cleanupFunctions.find(cf => cf.name === name);
    
    if (!cleanupFunction) {
      console.warn(`[CleanupManager] Cleanup function not found: ${name}`);
      return false;
    }

    try {
      cleanupFunction.cleanup();
      console.log(`[CleanupManager] Successfully triggered cleanup: ${name}`);
      return true;
    } catch (error) {
      console.error(`[CleanupManager] Failed to trigger cleanup: ${name}`, error);
      return false;
    }
  }
}

// 导出单例实例
export const cleanupManager = CleanupManager.getInstance();

// 开发环境下暴露到全局对象用于调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).cleanupManager = cleanupManager;
}