/**
 * リアルタイム接続管理システム
 * 安定した接続管理、自動再接続、接続プール機能付き
 */
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Platform, AppState, AppStateStatus } from 'react-native';

export interface ConnectionConfig {
  maxRetries: number;
  retryDelay: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  maxIdleTime: number;
}

export interface ChannelSubscription {
  id: string;
  channel: RealtimeChannel;
  topicIds: string[];
  isActive: boolean;
  lastActivity: number;
  onMessage?: (payload: any) => void;
  onTyping?: (payload: any) => void;
  onPresence?: (payload: any) => void;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  lastConnectionTime: number;
  totalReconnects: number;
}

class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager;
  
  private config: ConnectionConfig = {
    maxRetries: 5,
    retryDelay: 3000, // 增加重连延迟
    heartbeatInterval: 30000,
    connectionTimeout: 30000, // 增加连接超时时间 10s -> 30s
    maxIdleTime: 300000 // 5分間
  };
  
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private currentUserId: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    lastConnectionTime: 0,
    totalReconnects: 0
  };
  
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageListeners: Set<(message: any) => void> = new Set();
  
  // 降级轮询机制
  private fallbackPolling: boolean = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private pollingInterval: number = 5000; // 5秒轮询一次
  private lastPollingTime: number = 0;
  
  private constructor() {
    this.startHeartbeat();
    this.startCleanupTimer();
    
    // プラットフォーム固有の初期化
    this.initializePlatformListeners();
  }
  
  private initializePlatformListeners(): void {
    if (Platform.OS === 'web') {
      // Web環境でのイベントリスナー
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          this.disconnectAll();
        });
        
        // ページの可視性変更を監視
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
              this.pauseConnections();
            } else {
              this.resumeConnections();
            }
          });
        }
      }
    } else {
      // React Native環境でのAppStateリスナー
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          this.pauseConnections();
        } else if (nextAppState === 'active') {
          this.resumeConnections();
        }
      };
      
      AppState.addEventListener('change', handleAppStateChange);
    }
  }
  
  public static getInstance(): RealtimeConnectionManager {
    if (!RealtimeConnectionManager.instance) {
      RealtimeConnectionManager.instance = new RealtimeConnectionManager();
    }
    return RealtimeConnectionManager.instance;
  }
  
  /**
   * ユーザーIDを設定し、接続を初期化
   */
  public async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    this.setStatus('connecting');
    
    try {
      // 既存の接続をクリーンアップ
      await this.disconnectAll();
      
      // 新しい接続を開始
      await this.createGlobalSubscription(userId);
      
      this.setStatus('connected');
      this.stats.totalConnections++;
      this.stats.lastConnectionTime = Date.now();
      this.retryCount = 0;
      
      // 连接成功后停止降级轮询
      this.stopFallbackPolling();
      
      console.log('✅ リアルタイム接続管理システムが初期化されました');
      
    } catch (error) {
      console.error('❌ 接続初期化に失敗:', error);
      console.error('接続エラーの詳細:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        userId: userId,
        retryCount: this.retryCount,
        currentStatus: this.connectionStatus,
        timestamp: new Date().toISOString()
      });
      
      this.stats.failedConnections++;
      this.setStatus('error');
      
      // 启动降级轮询机制
      this.startFallbackPolling(userId);
      
      // 自動再接続を試行
      this.scheduleReconnect();
    }
  }
  
  /**
   * グローバル購読を作成
   */
  private async createGlobalSubscription(userId: string): Promise<void> {
    const subscriptionId = `global_${userId}`;
    
    // ユーザーが参加している話題IDを取得
    let topicIds = await this.getUserTopicIds(userId);
    
    if (topicIds.length === 0) {
      console.log('⚠️ 参加している話題がありません。空の購読を作成してブロードキャスト機能のみ有効化します。');
      // 話題が見つからない場合でも、グローバルなbroadcast購読を作成
      topicIds = ['*']; // 全話題に対応するプレースホルダー
    }
    
    console.log('🔄 创建频道订阅:', { subscriptionId, topicCount: topicIds.length });
    
    // チャンネルを作成 - broadcast機能を含める
    let channel = supabase
      .channel(subscriptionId, {
        config: {
          presence: {
            key: userId
          },
          broadcast: {
            self: true  // 自分の送信も受信する
          }
        }
      });
      
    // PostgreSQLの変更監視を設定
    if (topicIds.length > 0 && !topicIds.includes('*')) {
      // 特定の話題IDのみ監視
      channel = channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `topic_id=in.(${topicIds.join(',')})`
        },
        (payload) => {
          console.log('📩 新しいメッセージを受信:', payload);
          this.handleMessage(payload);
        }
      );
    } else {
      // 話題参加者データがない場合、全ての chat_messages を監視
      console.log('⚡ 全メッセージを監視するためのフォールバック設定');
      channel = channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          console.log('📩 新しいメッセージを受信（全監視）:', payload);
          this.handleMessage(payload);
        }
      );
    }
    
    // Broadcastイベントリスナーを追加
    channel = channel
      .on(
        'broadcast',
        { event: 'typing' },
        (payload) => {
          console.log('⌨️ 入力中イベント受信:', payload);
          this.handleTyping(payload);
        }
      )
      .on(
        'broadcast',
        { event: 'stop_typing' },
        (payload) => {
          console.log('⏹️ 入力停止イベント受信:', payload);
          this.handleStopTyping(payload);
        }
      )
      .on(
        'broadcast',
        { event: 'presence' },
        (payload) => {
          console.log('👥 プレゼンスイベント受信:', payload);
          this.handlePresence(payload);
        }
      );
    
    // 接続状態を監視
    const subscription = await new Promise<ChannelSubscription>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('⏰ 连接超时 - 30秒内未收到响应');
        reject(new Error('接続タイムアウト - 30秒以内に応答がありませんでした'));
      }, this.config.connectionTimeout);
      
      channel.subscribe((status) => {
        console.log('📡 频道状态变化:', { subscriptionId, status, timestamp: new Date().toISOString() });
        
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          
          console.log('✅ 频道订阅成功:', subscriptionId);
          
          const sub: ChannelSubscription = {
            id: subscriptionId,
            channel,
            topicIds,
            isActive: true,
            lastActivity: Date.now()
          };
          
          this.subscriptions.set(subscriptionId, sub);
          this.stats.activeConnections++;
          
          resolve(sub);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          
          console.error('❌ 频道连接失败:', { 
            subscriptionId, 
            status,
            topicIds: topicIds.length,
            error: `频道状态: ${status}`
          });
          
          reject(new Error(`接続失敗: ${status} - 频道无法建立连接`));
        } else if (status === 'CLOSED') {
          console.warn('🔌 频道连接已关闭:', subscriptionId);
          this.handleConnectionClosed(subscriptionId);
        } else {
          console.log('🔄 频道状态中间态:', { subscriptionId, status });
        }
      });
    });
    
    console.log(`グローバル購読を作成しました: ${topicIds.length}個の話題を監視中`);
  }
  
  /**
   * ユーザーが参加している話題IDを取得
   */
  private async getUserTopicIds(userId: string): Promise<string[]> {
    try {
      console.log('🔍 ユーザーの参加話題を検索中:', userId);
      
      const { data, error } = await supabase
        .from('topic_participants')
        .select('topic_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (error) {
        console.error('話題ID取得エラー:', error);
        
        // エラーの場合、代替方法として chat_messages から話題IDを取得
        console.log('📝 代替方法：ユーザーがメッセージを送った話題を取得');
        try {
          const { data: messageData, error: messageError } = await supabase
            .from('chat_messages')
            .select('topic_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50); // 最近の50件
          
          if (!messageError && messageData) {
            const uniqueTopicIds = [...new Set(messageData.map(row => row.topic_id))];
            console.log('📬 メッセージ履歴から取得した話題ID:', uniqueTopicIds);
            return uniqueTopicIds;
          }
        } catch (altError) {
          console.error('代替方法も失敗:', altError);
        }
        
        return [];
      }
      
      const topicIds = data?.map(row => row.topic_id) || [];
      console.log('✅ 参加している話題ID:', topicIds);
      
      // 話題参加者テーブルが空の場合、現在表示中の話題IDを追加
      if (topicIds.length === 0) {
        console.log('⚠️ 参加話題が見つかりません。現在のページから話題IDを推測します。');
        // この部分は後で現在の画面の話題IDを取得するロジックに置き換える
      }
      
      return topicIds;
    } catch (error) {
      console.error('話題ID取得に失敗:', error);
      return [];
    }
  }
  
  /**
   * メッセージハンドラー
   */
  private handleMessage(payload: any): void {
    try {
      this.updateActivity();
      this.messageListeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error('メッセージリスナーエラー:', error);
        }
      });
    } catch (error) {
      console.error('メッセージ処理エラー:', error);
    }
  }
  
  /**
   * 入力中インジケーターハンドラー
   */
  private handleTyping(payload: any): void {
    try {
      this.updateActivity();
      // 入力中の処理をここに実装
    } catch (error) {
      console.error('入力中処理エラー:', error);
    }
  }
  
  /**
   * 入力停止ハンドラー
   */
  private handleStopTyping(payload: any): void {
    try {
      this.updateActivity();
      // 入力停止の処理をここに実装
    } catch (error) {
      console.error('入力停止処理エラー:', error);
    }
  }
  
  /**
   * プレゼンスハンドラー
   */
  private handlePresence(payload: any): void {
    try {
      this.updateActivity();
      // プレゼンス処理をここに実装
    } catch (error) {
      console.error('プレゼンス処理エラー:', error);
    }
  }
  
  /**
   * プレゼンス同期ハンドラー
   */
  private handlePresenceSync(): void {
    // プレゼンス同期処理
  }
  
  /**
   * プレゼンス参加ハンドラー
   */
  private handlePresenceJoin(payload: any): void {
    // プレゼンス参加処理
  }
  
  /**
   * プレゼンス離脱ハンドラー
   */
  private handlePresenceLeave(payload: any): void {
    // プレゼンス離脱処理
  }
  
  /**
   * 接続クローズハンドラー
   */
  private handleConnectionClosed(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
    }
    
    // 自動再接続を試行
    if (this.connectionStatus === 'connected') {
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    }
  }
  
  /**
   * 再接続をスケジュール
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.retryCount >= this.config.maxRetries) {
      console.error('❌ 最大再接続回数に達しました', {
        maxRetries: this.config.maxRetries,
        totalReconnects: this.stats.totalReconnects,
        failedConnections: this.stats.failedConnections
      });
      this.setStatus('error');
      return;
    }
    
    // 指数退避 - 最大60秒まで
    const delay = Math.min(this.config.retryDelay * Math.pow(2, this.retryCount), 60000);
    
    console.log(`🔄 ${delay/1000}秒後に再接続を試行します... (${this.retryCount + 1}/${this.config.maxRetries})`);
    
    this.reconnectTimer = setTimeout(async () => {
      if (this.currentUserId) {
        this.retryCount++;
        this.stats.totalReconnects++;
        console.log(`🔄 再接続を試行中... (${this.retryCount}/${this.config.maxRetries})`);
        
        try {
          await this.initialize(this.currentUserId);
        } catch (error) {
          console.error('🔄 再接続に失敗:', error);
          this.scheduleReconnect();
        }
      }
    }, delay);
  }
  
  /**
   * 接続を一時停止
   */
  private pauseConnections(): void {
    console.log('接続を一時停止します');
    this.subscriptions.forEach(subscription => {
      if (subscription.isActive) {
        subscription.isActive = false;
      }
    });
  }
  
  /**
   * 接続を再開
   */
  private resumeConnections(): void {
    console.log('接続を再開します');
    if (this.currentUserId && this.connectionStatus !== 'connected') {
      this.initialize(this.currentUserId);
    }
  }
  
  /**
   * ハートビートを開始
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }
  
  /**
   * ハートビートを送信
   */
  private sendHeartbeat(): void {
    if (this.connectionStatus === 'connected') {
      this.subscriptions.forEach(subscription => {
        if (subscription.isActive && subscription.channel) {
          try {
            subscription.channel.send({
              type: 'broadcast',
              event: 'heartbeat',
              payload: { timestamp: Date.now() }
            });
          } catch (error) {
            console.warn('ハートビート送信失敗:', error);
          }
        }
      });
    }
  }
  
  /**
   * クリーンアップタイマーを開始
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // 1分ごと
  }
  
  /**
   * アイドル接続をクリーンアップ
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    this.subscriptions.forEach((subscription, id) => {
      if (now - subscription.lastActivity > this.config.maxIdleTime) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => {
      this.removeSubscription(id);
      console.log(`アイドル接続を削除しました: ${id}`);
    });
  }
  
  /**
   * 購読を削除
   */
  private removeSubscription(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      if (subscription.channel) {
        supabase.removeChannel(subscription.channel);
      }
      this.subscriptions.delete(id);
      if (subscription.isActive) {
        this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
      }
    }
  }
  
  /**
   * アクティビティを更新
   */
  private updateActivity(): void {
    const now = Date.now();
    this.subscriptions.forEach(subscription => {
      if (subscription.isActive) {
        subscription.lastActivity = now;
      }
    });
  }
  
  /**
   * 接続状態を設定
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusListeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          console.error('ステータスリスナーエラー:', error);
        }
      });
    }
  }
  
  /**
   * 启动降级轮询机制
   */
  private startFallbackPolling(userId: string): void {
    if (this.fallbackPolling) {
      return; // 已经在轮询中
    }
    
    console.log('🔄 启动降级轮询机制 - 每5秒检查新消息');
    this.fallbackPolling = true;
    this.lastPollingTime = Date.now();
    
    const poll = async () => {
      if (!this.fallbackPolling || this.connectionStatus === 'connected') {
        return; // 停止轮询或已连接
      }
      
      try {
        // 获取用户参与的话题
        const topicIds = await this.getUserTopicIds(userId);
        
        if (topicIds.length > 0) {
          // 查询最近的消息
          const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .in('topic_id', topicIds)
            .gt('created_at', new Date(this.lastPollingTime).toISOString())
            .order('created_at', { ascending: true });
          
          if (!error && data && data.length > 0) {
            console.log(`📬 轮询获取到 ${data.length} 条新消息`);
            
            // 模拟实时消息事件
            data.forEach(message => {
              this.messageListeners.forEach(listener => {
                try {
                  listener({
                    eventType: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    new: message,
                    old: null
                  });
                } catch (error) {
                  console.error('轮询消息处理错误:', error);
                }
              });
            });
            
            this.lastPollingTime = Date.now();
          }
        }
      } catch (error) {
        console.error('轮询查询错误:', error);
      }
      
      // 继续下次轮询
      if (this.fallbackPolling) {
        this.pollingTimer = setTimeout(poll, this.pollingInterval);
      }
    };
    
    // 开始轮询
    this.pollingTimer = setTimeout(poll, this.pollingInterval);
  }
  
  /**
   * 停止降级轮询机制
   */
  private stopFallbackPolling(): void {
    if (!this.fallbackPolling) {
      return;
    }
    
    console.log('⏹️ 停止降级轮询机制 - 实时连接已恢复');
    this.fallbackPolling = false;
    
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
  
  /**
   * 全ての接続を切断
   */
  public async disconnectAll(): Promise<void> {
    console.log('全ての接続を切断します');
    
    // 停止降级轮询
    this.stopFallbackPolling();
    
    // タイマーをクリア
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // 全ての購読を削除
    const subscriptionIds = Array.from(this.subscriptions.keys());
    subscriptionIds.forEach(id => {
      this.removeSubscription(id);
    });
    
    this.setStatus('disconnected');
    this.stats.activeConnections = 0;
  }
  
  /**
   * メッセージを送信
   */
  public sendMessage(topicId: string, event: string, payload: any): boolean {
    try {
      // 接続状態を確認
      if (this.connectionStatus !== 'connected') {
        console.warn(`リアルタイム接続が確立されていません: ${this.connectionStatus}`);
        return false;
      }

      // アクティブな購読を探す
      let foundSubscription = false;
      for (const subscription of this.subscriptions.values()) {
        // 特定の話題IDまたはワイルドカード（*）に対応
        if (subscription.isActive && (subscription.topicIds.includes(topicId) || subscription.topicIds.includes('*'))) {
          try {
            subscription.channel.send({
              type: 'broadcast',
              event,
              payload: { ...payload, topicId }
            });
            this.updateActivity();
            foundSubscription = true;
            console.log(`✅ メッセージ送信成功: ${event} → ${topicId}`);
            return true;
          } catch (channelError) {
            console.error(`チャネル送信エラー: ${event}`, channelError);
          }
        }
      }

      if (!foundSubscription) {
        console.warn(`対象の話題ID (${topicId}) に対するアクティブな購読が見つかりません`);
        console.log('現在の購読:', Array.from(this.subscriptions.entries()).map(([id, sub]) => ({
          id,
          isActive: sub.isActive,
          topicIds: sub.topicIds
        })));
      }

      return false;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }

  /**
   * 入力中インジケーターを送信
   */
  public sendTypingIndicator(topicId: string, userId: string): boolean {
    try {
      const success = this.sendMessage(topicId, 'typing', { 
        userId, 
        timestamp: Date.now() 
      });
      if (!success) {
        console.warn('入力中インジケーター送信に失敗');
      }
      return success;
    } catch (error) {
      console.error('入力中インジケーター送信エラー:', error);
      return false;
    }
  }

  /**
   * 入力停止インジケーターを送信
   */
  public sendStopTypingIndicator(topicId: string, userId: string): boolean {
    try {
      const success = this.sendMessage(topicId, 'stop_typing', { 
        userId, 
        timestamp: Date.now() 
      });
      if (!success) {
        console.warn('入力停止インジケーター送信に失敗');
      }
      return success;
    } catch (error) {
      console.error('入力停止インジケーター送信エラー:', error);
      return false;
    }
  }

  /**
   * プレゼンス更新を送信
   */
  public sendPresenceUpdate(topicId: string, userId: string, status: 'online' | 'offline' | 'typing'): boolean {
    try {
      const success = this.sendMessage(topicId, 'presence', { 
        userId, 
        status,
        timestamp: Date.now() 
      });
      if (!success) {
        console.warn('プレゼンス更新送信に失敗');
      }
      return success;
    } catch (error) {
      console.error('プレゼンス更新送信エラー:', error);
      return false;
    }
  }
  
  /**
   * 話題リストを更新
   */
  public async updateTopics(userId: string): Promise<void> {
    if (userId !== this.currentUserId) {
      return;
    }
    
    const newTopicIds = await this.getUserTopicIds(userId);
    const globalSub = this.subscriptions.get(`global_${userId}`);
    
    if (globalSub) {
      const currentTopicIds = globalSub.topicIds;
      const hasChanged = 
        newTopicIds.length !== currentTopicIds.length ||
        !newTopicIds.every(id => currentTopicIds.includes(id));
      
      if (hasChanged) {
        console.log('話題リストが変更されました。接続を再構築します');
        await this.initialize(userId);
      }
    }
  }
  
  /**
   * ステータスリスナーを追加
   */
  public addStatusListener(listener: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(listener);
  }
  
  /**
   * ステータスリスナーを削除
   */
  public removeStatusListener(listener: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(listener);
  }
  
  /**
   * メッセージリスナーを追加
   */
  public addMessageListener(listener: (message: any) => void): void {
    this.messageListeners.add(listener);
  }
  
  /**
   * メッセージリスナーを削除
   */
  public removeMessageListener(listener: (message: any) => void): void {
    this.messageListeners.delete(listener);
  }
  
  /**
   * 現在の接続状態を取得
   */
  public getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  /**
   * 接続統計を取得
   */
  public getStats(): ConnectionStats {
    return { ...this.stats };
  }
  
  /**
   * 接続が有効かどうか
   */
  public isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.stats.activeConnections > 0;
  }
  
  /**
   * 是否正在使用降级轮询模式
   */
  public isFallbackMode(): boolean {
    return this.fallbackPolling;
  }
  
  /**
   * 設定を更新
   */
  public updateConfig(newConfig: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // ハートビートインターバルが変更された場合は再開
    if (newConfig.heartbeatInterval) {
      this.startHeartbeat();
    }
  }
  
  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    status: ConnectionStatus;
    userId: string | null;
    subscriptions: { id: string; isActive: boolean; topicCount: number; lastActivity: number }[];
    stats: ConnectionStats;
    config: ConnectionConfig;
  } {
    return {
      status: this.connectionStatus,
      userId: this.currentUserId,
      subscriptions: Array.from(this.subscriptions.entries()).map(([id, sub]) => ({
        id,
        isActive: sub.isActive,
        topicCount: sub.topicIds.length,
        lastActivity: sub.lastActivity
      })),
      stats: this.getStats(),
      config: this.config
    };
  }
  
  /**
   * 現在表示中の話題IDを追加（動的に購読を拡張）
   */
  public async addCurrentTopicId(topicId: string): Promise<void> {
    if (!this.currentUserId || !topicId) {
      return;
    }

    console.log('🔗 現在の話題IDを購読に追加:', topicId);

    // 既存の購読を確認
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive) {
        // 既に含まれている場合はスキップ
        if (subscription.topicIds.includes(topicId) || subscription.topicIds.includes('*')) {
          console.log('✅ 話題IDは既に購読済み:', topicId);
          return;
        }

        // 話題IDを追加
        subscription.topicIds.push(topicId);
        console.log('➕ 話題IDを既存購読に追加:', topicId);
        return;
      }
    }

    // 購読が存在しない場合は再初期化
    console.log('🔄 購読が存在しないため再初期化します');
    await this.initialize(this.currentUserId);
  }

  /**
   * 強制再接続
   */
  public async forceReconnect(): Promise<void> {
    if (this.currentUserId) {
      this.retryCount = 0;
      this.setStatus('reconnecting');
      await this.initialize(this.currentUserId);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const realtimeConnectionManager = RealtimeConnectionManager.getInstance();