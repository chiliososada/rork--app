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