// Smart Tag System Types
// TokyoPark智能标签系统类型定义

export interface Tag {
  name: string;
  source: 'preset' | 'custom' | 'user_history';
  usageCount: number;
  relevanceScore?: number;
}

export interface TagRecommendation {
  tagName: string;
  recommendationType: 'personal' | 'location' | 'time' | 'popular';
  score: number;
}

export interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
}

export interface TagInputProps {
  onTagAdd: (tag: string) => void;
  existingTags: string[];
  placeholder?: string;
}

export interface CustomTag {
  id: string;
  tagName: string;
  normalizedName: string;
  createdBy: string;
  createdAt: string;
  usageCount: number;
  isVerified: boolean;
}

export interface UserTagPreference {
  id: string;
  userId: string;
  tagName: string;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
}

export interface LocationTagStat {
  id: string;
  tagName: string;
  latitude: number;
  longitude: number;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
}

export interface TimeBasedTagStat {
  id: string;
  tagName: string;
  hourOfDay: number;
  dayOfWeek: number;
  usageCount: number;
  lastUsedAt: string;
}

// カテゴリー設定
export interface TagCategory {
  icon: any; // Lucide icon component
  color: string;
  label: string;
}

export interface TagCategoryMap {
  personal: TagCategory;
  location: TagCategory;
  time: TagCategory;
  popular: TagCategory;
}