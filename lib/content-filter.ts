import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { ModerationStatus, ModerationReason, ContentFilterResult } from '@/types';

// 重複コンテンツチェック用のキャッシュエントリ
interface DuplicateCheckEntry {
  userId: string;
  contentHash: string;
  timestamp: number;
}

// 敏感語データベースエントリ
interface SensitiveWordEntry {
  id: string;
  word: string;
  category: string;
  severity: number;
  variations: string[];
  regex_pattern?: string;
  auto_action: ModerationStatus;
}

// 敏感語キャッシュデータ
interface SensitiveWordsCache {
  words: SensitiveWordEntry[];
  cacheVersion: string;
  lastUpdated: number;
}

// キャッシュ設定
const CACHE_DURATION = 5 * 60 * 1000; // 5分
const CACHE_VERSION_KEY = 'sensitive_words_cache_version';
const SENSITIVE_WORDS_CACHE_KEY = 'sensitive_words_cache';

// メモリキャッシュ（アプリ実行中のみ有効）
let memoryCache: SensitiveWordsCache | null = null;

// キャッシュクリーンアップのタイマー
let cacheCleanupTimer: NodeJS.Timeout | null = null;

// URL検出の正規表現
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// 重複チェックの時間窓（30分 = 30 * 60 * 1000ms）
const DUPLICATE_CHECK_WINDOW = 30 * 60 * 1000;

// AsyncStorageキー
const DUPLICATE_CACHE_KEY = 'content_filter_duplicate_cache';

/**
 * コンテンツハッシュを生成する
 * React Native環境で動作する簡単なハッシュ関数
 */
function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit integer に変換
  }
  return Math.abs(hash).toString(36);
}

/**
 * 重複チェックキャッシュを取得する
 */
async function getDuplicateCache(): Promise<DuplicateCheckEntry[]> {
  try {
    const cacheData = await AsyncStorage.getItem(DUPLICATE_CACHE_KEY);
    if (cacheData) {
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.warn('Failed to get duplicate cache:', error);
  }
  return [];
}

/**
 * 重複チェックキャッシュを更新する
 */
async function updateDuplicateCache(cache: DuplicateCheckEntry[]): Promise<void> {
  try {
    // 古いエントリを削除（30分以上前）
    const now = Date.now();
    const validCache = cache.filter(entry => 
      now - entry.timestamp < DUPLICATE_CHECK_WINDOW
    );
    
    await AsyncStorage.setItem(DUPLICATE_CACHE_KEY, JSON.stringify(validCache));
  } catch (error) {
    console.warn('Failed to update duplicate cache:', error);
  }
}

/**
 * データベースから敏感語を取得（キャッシュ機能付き）
 */
async function getSensitiveWords(): Promise<SensitiveWordEntry[]> {
  try {
    // 1. メモリキャッシュチェック
    if (memoryCache && (Date.now() - memoryCache.lastUpdated) < CACHE_DURATION) {
      return memoryCache.words;
    }

    // 2. キャッシュバージョンチェック
    const { data: versionData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', CACHE_VERSION_KEY)
      .single();

    const currentVersion = versionData?.value || '0';

    // 3. AsyncStorageキャッシュチェック
    try {
      const cachedData = await AsyncStorage.getItem(SENSITIVE_WORDS_CACHE_KEY);
      if (cachedData) {
        const cache: SensitiveWordsCache = JSON.parse(cachedData);
        if (cache.cacheVersion === currentVersion && 
            (Date.now() - cache.lastUpdated) < CACHE_DURATION) {
          memoryCache = cache;
          return cache.words;
        }
      }
    } catch (error) {
      console.warn('Failed to read sensitive words cache:', error);
    }

    // 4. データベースから取得
    const { data: wordsData, error } = await supabase
      .rpc('get_active_sensitive_words', { 
        language_param: 'ja',
        include_variations: true 
      });

    if (error) {
      console.error('Failed to fetch sensitive words:', error);
      // フォールバックとして空の配列を返す
      return [];
    }

    // 5. データを正規化
    const normalizedWords: SensitiveWordEntry[] = (wordsData || []).map((word: any) => ({
      id: word.id,
      word: word.word,
      category: word.category,
      severity: word.severity,
      variations: Array.isArray(word.variations) ? word.variations : [],
      regex_pattern: word.regex_pattern,
      auto_action: word.auto_action as ModerationStatus
    }));

    // 6. キャッシュを更新
    const newCache: SensitiveWordsCache = {
      words: normalizedWords,
      cacheVersion: currentVersion,
      lastUpdated: Date.now()
    };

    // メモリキャッシュ更新
    memoryCache = newCache;

    // AsyncStorageキャッシュ更新
    try {
      await AsyncStorage.setItem(SENSITIVE_WORDS_CACHE_KEY, JSON.stringify(newCache));
    } catch (error) {
      console.warn('Failed to save sensitive words cache:', error);
    }

    // 自动清理计时器设置
    scheduleMemoryCacheCleanup();

    return normalizedWords;

  } catch (error) {
    console.error('Error in getSensitiveWords:', error);
    
    // 尝试从本地缓存获取数据作为fallback
    try {
      const cachedData = await AsyncStorage.getItem(SENSITIVE_WORDS_CACHE_KEY);
      if (cachedData) {
        const cache: SensitiveWordsCache = JSON.parse(cachedData);
        console.warn('Using cached sensitive words due to fetch error');
        return cache.words;
      }
    } catch (cacheError) {
      console.error('Failed to read cache as fallback:', cacheError);
    }
    
    return [];
  }
}

/**
 * 敏感語をチェックする（データベース版）
 */
export async function checkSensitiveWords(content: string): Promise<{
  hasMatch: boolean;
  matchedWords: Array<{
    word: string;
    severity: number;
    category: string;
    auto_action: ModerationStatus;
  }>;
}> {
  try {
    const sensitiveWords = await getSensitiveWords();
    
    if (sensitiveWords.length === 0) {
      return { hasMatch: false, matchedWords: [] };
    }

    const normalizedContent = content.toLowerCase()
      .replace(/\s+/g, '') // 空白を除去
      .replace(/[！-～]/g, (match) => { // 全角記号を半角に変換
        return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
      });

    const matchedWords: Array<{
      word: string;
      severity: number;
      category: string;
      auto_action: ModerationStatus;
    }> = [];

    for (const sensitiveWord of sensitiveWords) {
      let isMatched = false;

      // 基本語のチェック
      if (normalizedContent.includes(sensitiveWord.word.toLowerCase())) {
        isMatched = true;
      }

      // バリエーションのチェック
      if (!isMatched && sensitiveWord.variations.length > 0) {
        for (const variation of sensitiveWord.variations) {
          if (normalizedContent.includes(variation.toLowerCase())) {
            isMatched = true;
            break;
          }
        }
      }

      // 正規表現のチェック（将来的な機能）
      if (!isMatched && sensitiveWord.regex_pattern) {
        try {
          const regex = new RegExp(sensitiveWord.regex_pattern, 'gi');
          if (regex.test(content)) {
            isMatched = true;
          }
        } catch (regexError) {
          console.warn('Invalid regex pattern for word:', sensitiveWord.word, regexError);
        }
      }

      if (isMatched) {
        matchedWords.push({
          word: sensitiveWord.word,
          severity: sensitiveWord.severity,
          category: sensitiveWord.category,
          auto_action: sensitiveWord.auto_action
        });
      }
    }

    return {
      hasMatch: matchedWords.length > 0,
      matchedWords
    };

  } catch (error) {
    console.error('Error in checkSensitiveWords:', error);
    return { hasMatch: false, matchedWords: [] };
  }
}

/**
 * 過剰なURL検出をチェックする
 */
export function checkExcessiveUrls(content: string): boolean {
  const urls = content.match(URL_REGEX);
  return urls !== null && urls.length > 2;
}

/**
 * 重複コンテンツをチェックする
 */
export async function checkDuplicateContent(
  content: string, 
  userId: string
): Promise<boolean> {
  try {
    const contentHash = generateContentHash(content);
    const cache = await getDuplicateCache();
    
    // 同じユーザーが30分以内に同じコンテンツを投稿しているかチェック
    const now = Date.now();
    const isDuplicate = cache.some(entry => 
      entry.userId === userId && 
      entry.contentHash === contentHash &&
      now - entry.timestamp < DUPLICATE_CHECK_WINDOW
    );
    
    if (!isDuplicate) {
      // 新しいエントリをキャッシュに追加
      const newEntry: DuplicateCheckEntry = {
        userId,
        contentHash,
        timestamp: now
      };
      cache.push(newEntry);
      await updateDuplicateCache(cache);
    }
    
    return isDuplicate;
  } catch (error) {
    console.warn('Failed to check duplicate content:', error);
    return false; // エラーの場合は重複なしとして処理
  }
}

/**
 * 带重试机制的内容过滤
 */
async function filterContentWithRetry(
  content: string, 
  userId: string,
  title?: string,
  retryCount: number = 0
): Promise<ContentFilterResult> {
  const maxRetries = 2;
  
  try {
    return await filterContentInternal(content, userId, title);
  } catch (error) {
    if (retryCount < maxRetries) {
      console.warn(`Content filtering failed, retrying... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 递增延迟
      return filterContentWithRetry(content, userId, title, retryCount + 1);
    }
    throw error;
  }
}

/**
 * 包括的なコンテンツフィルタリング (内部实现)
 */
async function filterContentInternal(
  content: string, 
  userId: string,
  title?: string
): Promise<ContentFilterResult> {
  // 空のコンテンツチェック
  if (!content.trim()) {
    const result: ContentFilterResult = {
      status: 'rejected',
      reason: 'manual_review',
      message: 'コンテンツが空です',
      details: '有効なコンテンツを入力してください'
    };
    return result;
  }

  // タイトルがある場合は組み合わせてチェック
  const fullContent = title ? `${title} ${content}` : content;

  // 1. 敏感語句チェック
  const sensitiveWordResult = await checkSensitiveWords(fullContent);
  if (sensitiveWordResult.hasMatch && sensitiveWordResult.matchedWords.length > 0) {
    // 最も厳しいアクションを決定
    const highestSeverity = Math.max(...sensitiveWordResult.matchedWords.map(w => w.severity));
    const criticalWord = sensitiveWordResult.matchedWords.find(w => w.severity === highestSeverity);
    
    // 高い重要度の場合は直接拒否
    if (highestSeverity >= 3) {
      const result: ContentFilterResult = {
        status: 'rejected',
        reason: 'sensitive_words',
        message: 'コンテンツが承認されませんでした',
        details: '不適切な表現が含まれております',
        matchedWords: sensitiveWordResult.matchedWords.map(w => w.word)
      };
      return result;
    }
    
    const result: ContentFilterResult = {
      status: criticalWord?.auto_action || 'pending',
      reason: 'sensitive_words',
      message: 'コンテンツが審査待ちです',
      details: '不適切な表現が含まれている可能性がございます',
      matchedWords: sensitiveWordResult.matchedWords.map(w => w.word)
    };
    return result;
  }

  // 2. 過剰URL検出
  if (checkExcessiveUrls(fullContent)) {
    const result: ContentFilterResult = {
      status: 'pending',
      reason: 'excessive_urls',
      message: 'コンテンツが審査待ちです',
      details: 'URLが多すぎる可能性がございます'
    };
    return result;
  }

  // 3. 重複コンテンツチェック
  const isDuplicate = await checkDuplicateContent(fullContent, userId);
  if (isDuplicate) {
    const result: ContentFilterResult = {
      status: 'pending',
      reason: 'duplicate_content',
      message: 'コンテンツが審査待ちです',
      details: '最近同じ内容を投稿している可能性がございます'
    };
    return result;
  }

  // すべてのチェックを通過
  const result: ContentFilterResult = {
    status: 'approved',
    reason: null,
    message: 'コンテンツが承認されました'
  };
  return result;
}

/**
 * 包括的なコンテンツフィルタリング (公开接口)
 */
export async function filterContent(
  content: string, 
  userId: string,
  title?: string
): Promise<ContentFilterResult> {
  return filterContentWithRetry(content, userId, title);
}

/**
 * 審査状態に応じた日本語メッセージを取得
 */
export function getModerationMessage(
  status: ModerationStatus, 
  reason: ModerationReason
): string {
  switch (status) {
    case 'pending':
      switch (reason) {
        case 'sensitive_words':
          return '不適切な表現が含まれている可能性があるため、審査中です。';
        case 'excessive_urls':
          return 'リンクが多すぎるため、審査中です。';
        case 'duplicate_content':
          return '重複するコンテンツの可能性があるため、審査中です。';
        default:
          return '内容を審査中です。しばらくお待ちください。';
      }
    case 'rejected':
      return 'コンテンツが承認されませんでした。内容を見直してください。';
    case 'approved':
    default:
      return 'コンテンツが承認されました。';
  }
}

/**
 * 敏感語マッチングをデータベースにログ記録
 */
async function logSensitiveWordMatches(
  matchedWords: Array<{
    word: string;
    severity: number;
    category: string;
    auto_action: ModerationStatus;
  }>,
  contentType: 'topic' | 'comment',
  contentId: string,
  userId: string,
  originalContent: string
): Promise<void> {
  try {
    for (const match of matchedWords) {
      // データベースから敏感語IDを取得（効率化のため、ここでは簡略化）
      const { data: wordData } = await supabase
        .from('sensitive_words')
        .select('id')
        .eq('word', match.word)
        .single();

      if (wordData) {
        await supabase.rpc('log_sensitive_word_match', {
          word_id_param: wordData.id,
          content_type_param: contentType,
          content_id_param: contentId,
          user_id_param: userId,
          matched_text_param: match.word,
          matched_word_param: match.word,
          context_text_param: originalContent.substring(0, 200), // 最初の200文字のみ
          action_taken_param: match.auto_action,
          match_method_param: 'exact'
        });
      }
    }
  } catch (error) {
    console.warn('Failed to log sensitive word matches:', error);
    // ログ記録の失敗はフィルタリング自体に影響しない
  }
}

/**
 * 内存缓存自动清理调度
 */
function scheduleMemoryCacheCleanup(): void {
  // 清除现有计时器
  if (cacheCleanupTimer) {
    clearTimeout(cacheCleanupTimer);
  }
  
  // 设置新的清理计时器（缓存过期时间的2倍，确保过期缓存被清理）
  cacheCleanupTimer = setTimeout(() => {
    if (memoryCache && (Date.now() - memoryCache.lastUpdated) > CACHE_DURATION * 2) {
      console.log('Cleaning up expired memory cache');
      memoryCache = null;
    }
    cacheCleanupTimer = null;
  }, CACHE_DURATION * 2);
}

/**
 * 敏感語キャッシュをクリア（管理用）
 */
export async function clearSensitiveWordsCache(): Promise<void> {
  try {
    memoryCache = null;
    
    // 清除计时器
    if (cacheCleanupTimer) {
      clearTimeout(cacheCleanupTimer);
      cacheCleanupTimer = null;
    }
    
    await AsyncStorage.removeItem(SENSITIVE_WORDS_CACHE_KEY);
    console.log('Sensitive words cache cleared');
  } catch (error) {
    console.warn('Failed to clear sensitive words cache:', error);
  }
}

/**
 * 重複チェックキャッシュをクリア（テスト用）
 */
export async function clearDuplicateCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DUPLICATE_CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear duplicate cache:', error);
  }
}

/**
 * 应用退出时清理所有缓存和计时器
 */
export function cleanupContentFilter(): void {
  try {
    // 清理内存缓存
    memoryCache = null;
    
    // 清理计时器
    if (cacheCleanupTimer) {
      clearTimeout(cacheCleanupTimer);
      cacheCleanupTimer = null;
    }
    
    console.log('Content filter cleanup completed');
  } catch (error) {
    console.warn('Failed to cleanup content filter:', error);
  }
}

/**
 * フィルタリング結果と共にマッチングをログ記録
 */
export async function filterContentWithLogging(
  content: string, 
  userId: string,
  contentType: 'topic' | 'comment',
  contentId?: string,
  title?: string
): Promise<ContentFilterResult> {
  const result = await filterContent(content, userId, title);
  
  // 敏感語がマッチした場合、ログに記録
  if (result.reason === 'sensitive_words' && result.matchedWords && contentId) {
    const sensitiveWordResult = await checkSensitiveWords(title ? `${title} ${content}` : content);
    if (sensitiveWordResult.hasMatch) {
      await logSensitiveWordMatches(
        sensitiveWordResult.matchedWords,
        contentType,
        contentId,
        userId,
        content
      );
    }
  }
  
  return result;
}