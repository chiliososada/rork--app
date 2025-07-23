import { Topic } from '@/types';

interface CachedTopic extends Topic {
  cacheTime: number;
  accessCount: number;
  lastAccessed: number;
}

class TopicCache {
  private cache = new Map<string, CachedTopic>();
  private readonly maxSize = 50; // Maximum number of cached topics
  private readonly maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Get a topic from cache
  get(topicId: string): Topic | null {
    const cached = this.cache.get(topicId);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry is expired
    if (Date.now() - cached.cacheTime > this.maxAge) {
      this.cache.delete(topicId);
      return null;
    }
    
    // Update access statistics
    cached.accessCount++;
    cached.lastAccessed = Date.now();
    
    return cached;
  }

  // Store a topic in cache
  set(topic: Topic): void {
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const now = Date.now();
    const cachedTopic: CachedTopic = {
      ...topic,
      cacheTime: now,
      accessCount: 1,
      lastAccessed: now
    };
    
    this.cache.set(topic.id, cachedTopic);
  }

  // Update a topic in cache if it exists
  update(topicId: string, updates: Partial<Topic>): void {
    const cached = this.cache.get(topicId);
    if (cached && Date.now() - cached.cacheTime <= this.maxAge) {
      Object.assign(cached, updates);
    }
  }

  // Remove a topic from cache
  remove(topicId: string): void {
    this.cache.delete(topicId);
  }

  // Get multiple topics from cache
  getMultiple(topicIds: string[]): (Topic | null)[] {
    return topicIds.map(id => this.get(id));
  }

  // Store multiple topics in cache
  setMultiple(topics: Topic[]): void {
    topics.forEach(topic => this.set(topic));
  }

  // Clear all cached topics
  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getStats(): { size: number; hitRate: number } {
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, cached) => sum + cached.accessCount, 0);
    
    return {
      size: this.cache.size,
      hitRate: totalAccess > 0 ? (this.cache.size / totalAccess) : 0
    };
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [id, cached] of this.cache.entries()) {
      if (now - cached.cacheTime > this.maxAge) {
        this.cache.delete(id);
      }
    }
  }

  // Evict least recently used item
  private evictLRU(): void {
    let oldestTime = Date.now();
    let oldestId = '';
    
    for (const [id, cached] of this.cache.entries()) {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }

  // Get popular topics (most accessed)
  getPopular(limit: number = 10): Topic[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map(cached => {
        const { cacheTime, accessCount, lastAccessed, ...topic } = cached;
        return topic;
      });
  }

  // Get recently viewed topics
  getRecent(limit: number = 10): Topic[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, limit)
      .map(cached => {
        const { cacheTime, accessCount, lastAccessed, ...topic } = cached;
        return topic;
      });
  }
}

// Create global cache instance
export const topicCache = new TopicCache();

// Auto-cleanup every 5 minutes
setInterval(() => {
  topicCache.cleanup();
}, 5 * 60 * 1000);

// Cache utility functions
export const cacheUtils = {
  // Check if a topic should be cached (e.g., recently viewed topics)
  shouldCache(topic: Topic): boolean {
    // Don't cache topics without essential data
    return !!(topic.id && topic.title && topic.author);
  },

  // Create a cache key for a topic query
  createQueryKey(params: {
    latitude?: number;
    longitude?: number;
    page?: number;
    search?: string;
    type?: string;
  }): string {
    const { latitude, longitude, page = 0, search = '', type = 'nearby' } = params;
    return `${type}_${latitude || 0}_${longitude || 0}_${page}_${search}`;
  },

  // Merge cached topics with fresh data
  mergeCachedAndFresh(cached: (Topic | null)[], fresh: Topic[]): Topic[] {
    const merged: Topic[] = [];
    const freshIds = new Set(fresh.map(t => t.id));
    
    // Add fresh topics first
    merged.push(...fresh);
    
    // Add cached topics that aren't in fresh data
    cached.forEach(topic => {
      if (topic && !freshIds.has(topic.id)) {
        merged.push(topic);
      }
    });
    
    return merged;
  }
};