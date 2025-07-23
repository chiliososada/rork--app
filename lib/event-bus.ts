type EventCallback = (data: any) => void;

class EventBus {
  private events: Map<string, Set<EventCallback>> = new Map();

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
      }
    };
  }

  // Emit an event
  emit(event: string, data?: any): void {
    const eventSet = this.events.get(event);
    if (eventSet) {
      eventSet.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for "${event}":`, error);
        }
      });
    }
  }

  // Remove all listeners for an event
  off(event: string): void {
    this.events.delete(event);
  }

  // Remove all listeners
  clear(): void {
    this.events.clear();
  }
}

// Create global event bus instance
export const eventBus = new EventBus();

// Event types for type safety
export const EVENT_TYPES = {
  // Topic interactions
  TOPIC_LIKED: 'topic:liked',
  TOPIC_UNLIKED: 'topic:unliked',
  TOPIC_FAVORITED: 'topic:favorited',
  TOPIC_UNFAVORITED: 'topic:unfavorited',
  TOPIC_COMMENTED: 'topic:commented',
  
  // Chat interactions
  MESSAGE_SENT: 'chat:message_sent',
  TOPIC_JOINED: 'chat:topic_joined',
  
  // Topic creation/update
  TOPIC_CREATED: 'topic:created',
  TOPIC_UPDATED: 'topic:updated',
  TOPIC_DELETED: 'topic:deleted',
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