import { eventBus } from './event-bus';

/**
 * Event Bus 调试工具
 * 用于开发环境中监控和诊断事件总线的使用情况
 */
export class EventBusDebugger {
  private static isEnabled = process.env.NODE_ENV === 'development';
  private static eventLog: Array<{
    timestamp: number;
    event: string;
    data: any;
    type: 'emit' | 'emitDebounced';
  }> = [];
  
  private static maxLogSize = 100;

  /**
   * 启用调试模式
   */
  static enable() {
    this.isEnabled = true;
    console.log('[EventBusDebugger] Debug mode enabled');
  }

  /**
   * 禁用调试模式
   */
  static disable() {
    this.isEnabled = false;
    console.log('[EventBusDebugger] Debug mode disabled');
  }

  /**
   * 记录事件发射
   */
  static logEvent(event: string, data: any, type: 'emit' | 'emitDebounced' = 'emit') {
    if (!this.isEnabled) return;

    const logEntry = {
      timestamp: Date.now(),
      event,
      data,
      type
    };

    this.eventLog.push(logEntry);

    // 保持日志大小限制
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.splice(0, this.eventLog.length - this.maxLogSize);
    }

    // 控制台输出
    const emoji = type === 'emitDebounced' ? '⏰' : '🚀';
    console.log(`${emoji} [EventBus] ${event}`, data);
  }

  /**
   * 获取最近的事件日志
   */
  static getRecentEvents(count: number = 10) {
    return this.eventLog.slice(-count);
  }

  /**
   * 获取事件统计信息
   */
  static getEventStats() {
    const stats = this.eventLog.reduce((acc, log) => {
      if (!acc[log.event]) {
        acc[log.event] = { count: 0, lastFired: 0 };
      }
      acc[log.event].count++;
      acc[log.event].lastFired = Math.max(acc[log.event].lastFired, log.timestamp);
      return acc;
    }, {} as Record<string, { count: number; lastFired: number }>);

    return Object.entries(stats)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([event, data]) => ({
        event,
        count: data.count,
        lastFired: new Date(data.lastFired).toLocaleTimeString()
      }));
  }

  /**
   * 清空事件日志
   */
  static clearLog() {
    this.eventLog = [];
    console.log('[EventBusDebugger] Event log cleared');
  }

  /**
   * 打印当前事件总线状态
   */
  static printStatus() {
    if (!this.isEnabled) {
      console.log('[EventBusDebugger] Debug mode is disabled');
      return;
    }

    const debugInfo = eventBus.getDebugInfo();
    const stats = this.getEventStats();

    console.group('🔍 Event Bus Status');
    console.log('📊 Active Events:', debugInfo.activeEvents.length);
    console.log('⏳ Debounced Events:', debugInfo.debouncedEvents.length);
    console.log('🔄 Emission Stack:', debugInfo.emissionStack.length);
    console.log('👂 Total Listeners:', debugInfo.totalListeners);
    
    if (debugInfo.emissionStack.length > 0) {
      console.warn('⚠️  Events currently being processed:', debugInfo.emissionStack);
    }
    
    if (debugInfo.debouncedEvents.length > 0) {
      console.log('⏰ Pending debounced events:', debugInfo.debouncedEvents);
    }

    if (stats.length > 0) {
      console.group('📈 Event Statistics (Top 10)');
      stats.slice(0, 10).forEach(({ event, count, lastFired }) => {
        console.log(`${event}: ${count} times (last: ${lastFired})`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * 检测可能的内存泄漏
   */
  static detectMemoryLeaks() {
    if (!this.isEnabled) return;

    const debugInfo = eventBus.getDebugInfo();
    const warnings: string[] = [];

    // 检查监听器数量
    if (debugInfo.totalListeners > 50) {
      warnings.push(`High number of event listeners (${debugInfo.totalListeners}). Check for cleanup issues.`);
    }

    // 检查防抖事件积累
    if (debugInfo.debouncedEvents.length > 10) {
      warnings.push(`High number of pending debounced events (${debugInfo.debouncedEvents.length}). This might indicate too frequent event emissions.`);
    }

    // 检查发射栈深度
    if (debugInfo.emissionStack.length > 5) {
      warnings.push(`Deep emission stack (${debugInfo.emissionStack.length}). This might indicate circular event emissions.`);
    }

    if (warnings.length > 0) {
      console.group('⚠️  Potential Memory Leak Warnings');
      warnings.forEach(warning => console.warn(warning));
      console.groupEnd();
    } else if (this.isEnabled) {
      console.log('✅ No memory leak indicators detected');
    }

    return warnings;
  }

  /**
   * 启动定期健康检查
   */
  static startHealthCheck(intervalMs: number = 30000) {
    if (!this.isEnabled) return;

    const checkInterval = setInterval(() => {
      this.detectMemoryLeaks();
    }, intervalMs);

    // 返回清理函数
    return () => {
      clearInterval(checkInterval);
    };
  }
}

// 在开发环境自动启用
if (process.env.NODE_ENV === 'development') {
  EventBusDebugger.enable();
  
  // 添加到全局对象方便调试
  if (typeof window !== 'undefined') {
    (window as any).eventBusDebugger = EventBusDebugger;
  }
}