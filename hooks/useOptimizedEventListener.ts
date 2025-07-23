import { useEffect, useRef } from 'react';
import { eventBus, EVENT_TYPES, PAGE_EVENT_RELEVANCE, DEBOUNCED_EVENTS } from '@/lib/event-bus';

type PageType = keyof typeof PAGE_EVENT_RELEVANCE;
type EventType = keyof typeof EVENT_TYPES;

interface EventListenerOptions {
  /**
   * Page type for filtering relevant events
   */
  page?: PageType;
  /**
   * Custom event filter function
   */
  eventFilter?: (eventType: string) => boolean;
  /**
   * Override debouncing for specific events
   */
  forceImmediate?: boolean;
  /**
   * Custom debounce delay (default: 300ms)
   */
  debounceDelay?: number;
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

interface EventHandlers {
  [key: string]: (data: any) => void;
}

/**
 * Optimized event listener hook with automatic cleanup, debouncing, and page filtering
 */
export function useOptimizedEventListener(
  handlers: EventHandlers,
  options: EventListenerOptions = {}
) {
  const {
    page,
    eventFilter,
    forceImmediate = false,
    debounceDelay = 300,
    debug = false
  } = options;

  const unsubscribersRef = useRef<Array<() => void>>([]);
  const handlersRef = useRef(handlers);

  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    // Clean up previous subscriptions
    unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
    unsubscribersRef.current = [];

    // Determine which events to listen to
    const eventsToListenTo = Object.keys(handlers).filter(eventType => {
      // Apply page filtering if specified
      if (page && PAGE_EVENT_RELEVANCE[page]) {
        const isRelevantForPage = PAGE_EVENT_RELEVANCE[page].has(eventType as any);
        if (!isRelevantForPage) {
          if (debug) {
            console.log(`[EventListener] Skipping event ${eventType} - not relevant for page ${page}`);
          }
          return false;
        }
      }

      // Apply custom filter if provided
      if (eventFilter && !eventFilter(eventType)) {
        if (debug) {
          console.log(`[EventListener] Skipping event ${eventType} - filtered by eventFilter`);
        }
        return false;
      }

      return true;
    });

    if (debug) {
      console.log(`[EventListener] Subscribing to events:`, eventsToListenTo);
    }

    // Subscribe to filtered events
    eventsToListenTo.forEach(eventType => {
      const handler = (data: any) => {
        if (debug) {
          console.log(`[EventListener] Received event ${eventType}:`, data);
        }
        
        const currentHandler = handlersRef.current[eventType];
        if (currentHandler) {
          try {
            currentHandler(data);
          } catch (error) {
            console.error(`[EventListener] Error in handler for ${eventType}:`, error);
          }
        }
      };

      // Determine if this event should be debounced
      const shouldDebounce = !forceImmediate && DEBOUNCED_EVENTS.has(eventType as any);
      
      let unsubscribe: () => void;
      
      if (shouldDebounce) {
        // Subscribe with debouncing
        unsubscribe = eventBus.on(eventType, handler);
        
        if (debug) {
          console.log(`[EventListener] Event ${eventType} will use debouncing (${debounceDelay}ms)`);
        }
      } else {
        // Subscribe without debouncing
        unsubscribe = eventBus.on(eventType, handler);
        
        if (debug) {
          console.log(`[EventListener] Event ${eventType} will fire immediately`);
        }
      }

      unsubscribersRef.current.push(unsubscribe);
    });

    // Cleanup function
    return () => {
      if (debug) {
        console.log(`[EventListener] Cleaning up ${unsubscribersRef.current.length} event subscriptions`);
      }
      
      unsubscribersRef.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('[EventListener] Error during cleanup:', error);
        }
      });
      unsubscribersRef.current = [];
    };
  }, [page, eventFilter, forceImmediate, debounceDelay, debug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('[EventListener] Error during unmount cleanup:', error);
        }
      });
    };
  }, []);
}

/**
 * Emit an event with automatic debouncing detection
 */
export function emitOptimizedEvent(eventType: string, data?: any, options?: {
  forceImmediate?: boolean;
  debounceDelay?: number;
}) {
  const { forceImmediate = false, debounceDelay = 300 } = options || {};
  
  if (!forceImmediate && DEBOUNCED_EVENTS.has(eventType as any)) {
    eventBus.emitDebounced(eventType, data, debounceDelay);
  } else {
    eventBus.emit(eventType, data);
  }
}

/**
 * Get event bus debug information
 */
export function getEventBusDebugInfo() {
  return eventBus.getDebugInfo();
}