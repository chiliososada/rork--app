# Event Bus 优化指南

本文档描述了事件总线的优化实现，包括内存泄漏防护、防抖机制、循环检测等功能。

## 主要改进

### 1. 自动清理和内存泄漏防护

```typescript
// 事件监听器会在组件卸载时自动清理
const unsubscribe = eventBus.on('event', callback);
// unsubscribe() 会自动调用，无需手动管理
```

### 2. 防抖机制

```typescript
// 自动防抖（适用于频繁触发的事件）
eventBus.emitDebounced('topic:liked', data, 300); // 300ms 防抖

// 立即触发
eventBus.emit('topic:created', data); // 立即执行
```

### 3. 循环检测

```typescript
// 自动检测并防止无限循环
eventBus.emit('event1', data); // 如果触发循环，会自动阻止
```

### 4. 页面级事件过滤

```typescript
// 只监听与当前页面相关的事件
useOptimizedEventListener(handlers, {
  page: 'HOME', // 只监听 HOME 页面相关的事件
  debug: true   // 开发环境调试
});
```

## 使用方法

### 基础用法

```typescript
import { useOptimizedEventListener } from '@/hooks/useOptimizedEventListener';
import { EVENT_TYPES } from '@/lib/event-bus';

function MyComponent() {
  useOptimizedEventListener({
    [EVENT_TYPES.TOPIC_LIKED]: (data) => {
      console.log('Topic liked:', data);
    },
    [EVENT_TYPES.TOPIC_CREATED]: (data) => {
      console.log('Topic created:', data);
    }
  }, {
    page: 'HOME',           // 页面过滤
    forceImmediate: false,  // 使用默认防抖设置
    debounceDelay: 300,     // 自定义防抖延迟
    debug: true             // 启用调试日志
  });
}
```

### 页面专用 Hooks

```typescript
import { useHomePageEvents } from '@/hooks/usePageEventListeners';

function HomePage() {
  useHomePageEvents({
    onTopicLiked: (data) => {
      // 处理点赞事件
    },
    onTopicCreated: (data) => {
      // 处理话题创建事件
    }
  });
}
```

### 事件发射

```typescript
import { emitOptimizedEvent } from '@/hooks/useOptimizedEventListener';

// 自动判断是否需要防抖
emitOptimizedEvent(EVENT_TYPES.TOPIC_LIKED, data);

// 强制立即执行
emitOptimizedEvent(EVENT_TYPES.TOPIC_CREATED, data, {
  forceImmediate: true
});

// 自定义防抖延迟
emitOptimizedEvent(EVENT_TYPES.TOPIC_LIKED, data, {
  debounceDelay: 500
});
```

## 调试工具

### 开发环境调试

```typescript
// 在浏览器控制台中使用
window.eventBusDebugger.printStatus();      // 打印当前状态
window.eventBusDebugger.getEventStats();    // 获取事件统计
window.eventBusDebugger.detectMemoryLeaks(); // 检测内存泄漏
```

### 健康检查

```typescript
import { EventBusDebugger } from '@/lib/event-bus-debug';

// 启动定期健康检查
const stopHealthCheck = EventBusDebugger.startHealthCheck(30000);

// 停止健康检查
stopHealthCheck();
```

## 页面事件映射

### HOME 页面
- `TOPIC_LIKED` / `TOPIC_UNLIKED`
- `TOPIC_FAVORITED` / `TOPIC_UNFAVORITED`  
- `TOPIC_COMMENTED`
- `TOPIC_CREATED` / `TOPIC_UPDATED` / `TOPIC_DELETED`
- `LOCATION_CHANGED`

### EXPLORE 页面
- 所有 HOME 页面事件
- `MAP_VIEWPORT_CHANGED`

### CHAT 页面
- `TOPIC_LIKED` / `TOPIC_UNLIKED`
- `TOPIC_FAVORITED` / `TOPIC_UNFAVORITED`
- `MESSAGE_SENT` / `TOPIC_JOINED`
- `TOPIC_UPDATED` / `TOPIC_DELETED`

### PROFILE 页面
- `TOPIC_FAVORITED` / `TOPIC_UNFAVORITED`
- `TOPIC_LIKED` / `TOPIC_UNLIKED`
- `TOPIC_COMMENTED`
- `TOPIC_CREATED` / `TOPIC_DELETED`

## 防抖事件列表

以下事件默认使用防抖机制：
- `TOPIC_LIKED` / `TOPIC_UNLIKED` (200ms)
- `MESSAGE_SENT` (300ms)
- `LOCATION_CHANGED` (300ms)
- `MAP_VIEWPORT_CHANGED` (300ms)

## 最佳实践

### 1. 组件中使用页面专用 Hooks

```typescript
// ✅ 推荐：使用页面专用的 Hook
useHomePageEvents({
  onTopicLiked: handleTopicLiked
});

// ❌ 不推荐：直接使用通用 Hook 监听所有事件
useOptimizedEventListener({
  [EVENT_TYPES.TOPIC_LIKED]: handleTopicLiked,
  [EVENT_TYPES.MESSAGE_SENT]: handleMessageSent, // HOME 页面不需要
});
```

### 2. 避免在事件处理器中再次发射相同事件

```typescript
// ❌ 可能导致循环
eventBus.on(EVENT_TYPES.TOPIC_LIKED, (data) => {
  eventBus.emit(EVENT_TYPES.TOPIC_LIKED, data); // 循环！
});

// ✅ 正确做法
eventBus.on(EVENT_TYPES.TOPIC_LIKED, (data) => {
  updateLocalState(data);
});
```

### 3. 在 Store 中使用页面过滤

```typescript
// ✅ 只监听相关事件
const homeRelevantEvents = PAGE_EVENT_RELEVANCE.HOME;
if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_LIKED)) {
  // 设置监听器
}
```

### 4. 使用调试工具监控性能

```typescript
// 开发环境定期检查
if (process.env.NODE_ENV === 'development') {
  EventBusDebugger.startHealthCheck();
}
```

## 性能指标

优化后的事件总线具有以下性能特征：

- **内存使用**：自动清理减少内存泄漏
- **CPU 使用**：防抖机制减少频繁更新
- **网络请求**：页面过滤减少不必要的状态同步
- **调试能力**：完整的监控和诊断工具

## 故障排除

### 常见问题

1. **事件没有触发**
   - 检查页面事件映射是否包含该事件
   - 确认事件名称拼写正确
   - 使用调试工具查看监听器状态

2. **内存泄漏警告**
   - 检查组件是否正确卸载
   - 使用 EventBusDebugger 检测泄漏源
   - 确认清理函数被正确调用

3. **事件延迟触发**
   - 检查是否被防抖机制影响
   - 使用 `forceImmediate: true` 跳过防抖
   - 调整防抖延迟时间