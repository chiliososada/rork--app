import { create } from 'zustand';
import { Topic, Comment, Message } from '@/types';
import { mockTopics, mockComments, mockMessages } from '@/mocks/data';

interface TopicState {
  topics: Topic[];
  filteredTopics: Topic[];
  currentTopic: Topic | null;
  comments: Comment[];
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  
  fetchNearbyTopics: (latitude: number, longitude: number) => Promise<void>;
  fetchTopicById: (id: string) => Promise<void>;
  fetchComments: (topicId: string) => Promise<void>;
  fetchMessages: (topicId: string) => Promise<void>;
  addComment: (topicId: string, text: string, userId: string) => Promise<void>;
  addMessage: (topicId: string, text: string, userId: string) => Promise<void>;
  createTopic: (topic: Omit<Topic, 'id' | 'createdAt' | 'commentCount' | 'participantCount'>) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  filteredTopics: [],
  currentTopic: null,
  comments: [],
  messages: [],
  isLoading: false,
  error: null,
  searchQuery: '',

  fetchNearbyTopics: async (latitude, longitude) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate distances (in a real app, this would be done server-side)
      const topicsWithDistance = mockTopics.map(topic => {
        const distance = calculateDistance(
          latitude, 
          longitude, 
          topic.location.latitude, 
          topic.location.longitude
        );
        
        return {
          ...topic,
          distance
        };
      });
      
      // Sort by distance
      const sortedTopics = topicsWithDistance.sort((a, b) => a.distance - b.distance);
      
      set({ 
        topics: sortedTopics,
        filteredTopics: sortedTopics,
        isLoading: false 
      });
      
      // Apply current search if exists
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
    } catch (error) {
      set({ 
        error: "Failed to fetch nearby topics", 
        isLoading: false 
      });
    }
  },

  fetchTopicById: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const topic = mockTopics.find(t => t.id === id);
      
      if (!topic) {
        set({ 
          error: "Topic not found", 
          isLoading: false 
        });
        return;
      }
      
      set({ 
        currentTopic: topic,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: "Failed to fetch topic", 
        isLoading: false 
      });
    }
  },

  fetchComments: async (topicId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const topicComments = mockComments.filter(c => c.topicId === topicId);
      
      set({ 
        comments: topicComments,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: "Failed to fetch comments", 
        isLoading: false 
      });
    }
  },

  fetchMessages: async (topicId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const topicMessages = mockMessages.filter(m => m.topicId === topicId);
      
      set({ 
        messages: topicMessages,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: "Failed to fetch messages", 
        isLoading: false 
      });
    }
  },

  addComment: async (topicId, text, userId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const user = mockTopics.find(t => t.id === topicId)?.author;
      
      if (!user) {
        set({ 
          error: "User not found", 
          isLoading: false 
        });
        return;
      }
      
      const newComment: Comment = {
        id: `comment-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
        author: user,
        likes: 0,
        topicId
      };
      
      set(state => ({ 
        comments: [...state.comments, newComment],
        isLoading: false 
      }));
    } catch (error) {
      set({ 
        error: "Failed to add comment", 
        isLoading: false 
      });
    }
  },

  addMessage: async (topicId, text, userId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const user = mockTopics.find(t => t.id === topicId)?.author;
      
      if (!user) {
        set({ 
          error: "User not found", 
          isLoading: false 
        });
        return;
      }
      
      const newMessage: Message = {
        id: `message-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
        author: user,
        topicId
      };
      
      set(state => ({ 
        messages: [...state.messages, newMessage],
        isLoading: false 
      }));
    } catch (error) {
      set({ 
        error: "Failed to send message", 
        isLoading: false 
      });
    }
  },

  createTopic: async (topicData) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTopic: Topic = {
        id: `topic-${Date.now()}`,
        ...topicData,
        createdAt: new Date().toISOString(),
        commentCount: 0,
        participantCount: 1
      };
      
      set(state => ({ 
        topics: [newTopic, ...state.topics],
        filteredTopics: [newTopic, ...state.filteredTopics],
        currentTopic: newTopic,
        isLoading: false 
      }));
    } catch (error) {
      set({ 
        error: "Failed to create topic", 
        isLoading: false 
      });
    }
  },

  searchTopics: (query) => {
    const { topics } = get();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      set({ 
        filteredTopics: topics,
        searchQuery: query 
      });
      return;
    }
    
    const filtered = topics.filter(topic => {
      const titleMatch = topic.title.toLowerCase().includes(normalizedQuery);
      const descriptionMatch = topic.description.toLowerCase().includes(normalizedQuery);
      const authorMatch = topic.author.name.toLowerCase().includes(normalizedQuery);
      const locationMatch = topic.location.name?.toLowerCase().includes(normalizedQuery) || false;
      
      return titleMatch || descriptionMatch || authorMatch || locationMatch;
    });
    
    set({ 
      filteredTopics: filtered,
      searchQuery: query 
    });
  },

  clearSearch: () => {
    const { topics } = get();
    set({ 
      filteredTopics: topics,
      searchQuery: '' 
    });
  }
}));

// Helper function to calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}