type EventCallback = (data: any) => void;

interface DebouncedEvent {
  timeout: ReturnType<typeof setTimeout>;
  data: any;
}

class EventBus {
  private events: Map<string, Set<EventCallback>> = new Map();
  private debouncedEvents: Map<string, DebouncedEvent> = new Map();
  private emissionStack: Set<string> = new Set(); // Track current emissions to prevent infinite loops
  private maxStackDepth = 10; // Maximum recursive emission depth

  // Subscribe to an event
  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    const eventSet = this.events.get(event)!;
    eventSet.add(callback);
    
    // Return unsubscribe function
    return () => {
      eventSet.delete(callback);
      if (eventSet.size === 0) {
        this.events.delete(event);
        // Clean up any pending debounced events
        this.cancelDebouncedEvent(event);
      }
    };
  }

  // Emit an event immediately
  emit(event: string, data?: any): void {
    this.emitInternal(event, data, false);
  }

  // Emit an event with debouncing
  emitDebounced(event: string, data?: any, delay: number = 300): void {
    this.emitInternal(event, data, true, delay);
  }

  private emitInternal(event: string, data?: any, debounced: boolean = false, delay: number = 300): void {
    // Prevent infinite loops
    if (this.emissionStack.has(event)) {
      console.warn(`Circular event emission detected for "${event}". Skipping to prevent infinite loop.`);
      return;
    }

    if (this.emissionStack.size >= this.maxStackDepth) {
      console.warn(`Maximum event emission depth (${this.maxStackDepth}) reached for "${event}". Skipping to prevent stack overflow.`);
      return;
    }

    if (debounced) {
      this.handleDebouncedEmission(event, data, delay);
      return;
    }

    this.executeEmission(event, data);
  }

  private handleDebouncedEmission(event: string, data: any, delay: number): void {
    // Cancel existing debounced event
    this.cancelDebouncedEvent(event);

    // Set new debounced event
    const timeout = setTimeout(() => {
      this.debouncedEvents.delete(event);
      this.executeEmission(event, data);
    }, delay);

    this.debouncedEvents.set(event, { timeout, data });
  }

  private executeEmission(event: string, data: any): void {
    const eventSet = this.events.get(event);
    if (!eventSet || eventSet.size === 0) {
      return;
    }

    // Add to emission stack to prevent infinite loops
    this.emissionStack.add(event);

    try {
      // Create a copy of the callback set to avoid issues if callbacks modify the set during iteration
      const callbacks = Array.from(eventSet);
      
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for "${event}":`, error);
          // Continue processing other callbacks even if one fails
        }
      });
    } finally {
      // Always remove from emission stack
      this.emissionStack.delete(event);
    }
  }

  private cancelDebouncedEvent(event: string): void {
    const debouncedEvent = this.debouncedEvents.get(event);
    if (debouncedEvent) {
      clearTimeout(debouncedEvent.timeout);
      this.debouncedEvents.delete(event);
    }
  }

  // Remove all listeners for an event
  off(event: string): void {
    this.events.delete(event);
    this.cancelDebouncedEvent(event);
  }

  // Remove all listeners and clear all pending debounced events
  clear(): void {
    // Clear all debounced timeouts
    this.debouncedEvents.forEach(({ timeout }) => {
      clearTimeout(timeout);
    });
    
    this.events.clear();
    this.debouncedEvents.clear();
    this.emissionStack.clear();
  }

  // Get debug information about the event bus state
  getDebugInfo(): {
    activeEvents: string[];
    debouncedEvents: string[];
    emissionStack: string[];
    totalListeners: number;
  } {
    const activeEvents = Array.from(this.events.keys());
    const debouncedEvents = Array.from(this.debouncedEvents.keys());
    const emissionStack = Array.from(this.emissionStack);
    const totalListeners = Array.from(this.events.values())
      .reduce((total, eventSet) => total + eventSet.size, 0);

    return {
      activeEvents,
      debouncedEvents,
      emissionStack,
      totalListeners
    };
  }
}

// Create global event bus instance
export const eventBus = new EventBus();

// Event types for type safety
export const EVENT_TYPES = {
  // Topic interactions (should be debounced for frequent updates)
  TOPIC_LIKED: 'topic:liked',
  TOPIC_UNLIKED: 'topic:unliked',
  TOPIC_FAVORITED: 'topic:favorited',
  TOPIC_UNFAVORITED: 'topic:unfavorited',
  TOPIC_COMMENTED: 'topic:commented',
  
  // Chat interactions (frequent events that benefit from debouncing)
  MESSAGE_SENT: 'chat:message_sent',
  TOPIC_JOINED: 'chat:topic_joined',
  
  // Topic creation/update (immediate events)
  TOPIC_CREATED: 'topic:created',
  TOPIC_UPDATED: 'topic:updated',
  TOPIC_DELETED: 'topic:deleted',

  // Location/map updates (should be debounced)
  LOCATION_CHANGED: 'location:changed',
  MAP_VIEWPORT_CHANGED: 'map:viewport_changed',
} as const;

// Events that should be debounced by default
export const DEBOUNCED_EVENTS = new Set([
  EVENT_TYPES.TOPIC_LIKED,
  EVENT_TYPES.TOPIC_UNLIKED,
  EVENT_TYPES.MESSAGE_SENT,
  EVENT_TYPES.LOCATION_CHANGED,
  EVENT_TYPES.MAP_VIEWPORT_CHANGED,
]);

// Page-specific event relevance mapping
export const PAGE_EVENT_RELEVANCE = {
  HOME: new Set([
    EVENT_TYPES.TOPIC_LIKED,
    EVENT_TYPES.TOPIC_UNLIKED,
    EVENT_TYPES.TOPIC_FAVORITED,
    EVENT_TYPES.TOPIC_UNFAVORITED,
    EVENT_TYPES.TOPIC_COMMENTED,
    EVENT_TYPES.TOPIC_CREATED,
    EVENT_TYPES.TOPIC_UPDATED,
    EVENT_TYPES.TOPIC_DELETED,
    EVENT_TYPES.LOCATION_CHANGED,
  ]),
  EXPLORE: new Set([
    EVENT_TYPES.TOPIC_LIKED,
    EVENT_TYPES.TOPIC_UNLIKED,
    EVENT_TYPES.TOPIC_FAVORITED,
    EVENT_TYPES.TOPIC_UNFAVORITED,
    EVENT_TYPES.TOPIC_COMMENTED,
    EVENT_TYPES.TOPIC_CREATED,
    EVENT_TYPES.TOPIC_UPDATED,
    EVENT_TYPES.TOPIC_DELETED,
    EVENT_TYPES.MAP_VIEWPORT_CHANGED,
    EVENT_TYPES.LOCATION_CHANGED,
  ]),
  CHAT: new Set([
    EVENT_TYPES.TOPIC_LIKED,
    EVENT_TYPES.TOPIC_UNLIKED,
    EVENT_TYPES.TOPIC_FAVORITED,
    EVENT_TYPES.TOPIC_UNFAVORITED,
    EVENT_TYPES.MESSAGE_SENT,
    EVENT_TYPES.TOPIC_JOINED,
    EVENT_TYPES.TOPIC_UPDATED,
    EVENT_TYPES.TOPIC_DELETED,
  ]),
  PROFILE: new Set([
    EVENT_TYPES.TOPIC_FAVORITED,
    EVENT_TYPES.TOPIC_UNFAVORITED,
    EVENT_TYPES.TOPIC_LIKED,
    EVENT_TYPES.TOPIC_UNLIKED,
    EVENT_TYPES.TOPIC_COMMENTED,
    EVENT_TYPES.TOPIC_CREATED,
    EVENT_TYPES.TOPIC_DELETED,
  ]),
} as const;

// Event data interfaces
export interface TopicInteractionEvent {
  topicId: string;
  userId: string;
  count?: number; // for likes/favorites count
}

export interface CommentEvent {
  topicId: string;
  userId: string;
  commentCount: number;
}

export interface MessageEvent {
  topicId: string;
  userId: string;
  messageTime: string;
  participantCount?: number;
}

export interface TopicEvent {
  topic: {
    id: string;
    title: string;
    description: string;
    author: {
      id: string;
      name: string;
      avatar: string;
      email: string;
    };
    location: {
      latitude: number;
      longitude: number;
      name?: string;
    };
    createdAt: string;
    imageUrl?: string;
    aspectRatio?: '1:1' | '4:5' | '1.91:1';
  };
}