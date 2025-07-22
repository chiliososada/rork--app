export interface User {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  author: User;
  location: Location;
  distance?: number; // Distance from user in meters
  commentCount: number;
  participantCount: number;
  lastMessageTime?: string; // Time of the last message in this topic
  imageUrl?: string; // URL of the topic image
  aspectRatio?: '1:1' | '4:5' | '1.91:1'; // Image aspect ratio
  
  // 点赞相关
  isLiked?: boolean; // Whether current user has liked this topic
  likesCount?: number; // Total number of likes
  
  // 收藏相关
  isFavorited?: boolean; // Whether current user has favorited this topic
  favoritesCount?: number; // Total number of favorites (optional)
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  author: User;
  likes: number;
  topicId: string;
  isLikedByUser?: boolean;
}

export interface Message {
  id: string;
  text: string;
  createdAt: string;
  author: User;
  topicId: string;
}

export interface TopicFavorite {
  id: string;
  userId: string;
  topicId: string;
  createdAt: string;
  topic?: Topic; // Associated topic info (for favorites list)
}