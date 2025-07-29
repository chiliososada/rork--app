export interface User {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
  // フォロー関連
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
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
  originalWidth?: number; // Original image width in pixels
  originalHeight?: number; // Original image height in pixels
  
  // 点赞相关
  isLiked?: boolean; // Whether current user has liked this topic
  likesCount?: number; // Total number of likes
  
  // 收藏相关
  isFavorited?: boolean; // Whether current user has favorited this topic
  favoritesCount?: number; // Total number of favorites (optional)
  
  // 聊天参与相关
  isParticipated?: boolean; // Whether current user has joined this topic's chat
  lastMessagePreview?: string; // Preview of the last message (for chat list)
  
  // 标签相关
  tags?: string[]; // Array of selected tags for this topic
  
  // 分类相关
  category?: string; // Topic category
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
  topicId?: string; // オプショナルに変更
  chatId?: string;  // プライベートチャット用に追加
  type: 'topic' | 'private'; // メッセージタイプを区別
}

export interface TopicFavorite {
  id: string;
  userId: string;
  topicId: string;
  createdAt: string;
  topic?: Topic; // Associated topic info (for favorites list)
}

export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  follower?: User;
  following?: User;
}

export interface FollowStats {
  userId: string;
  followersCount: number;
  followingCount: number;
}

export interface FollowStatus {
  userId: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
}

export interface PrivateChat {
  id: string;
  participant1Id: string;
  participant2Id: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  // UI表示用
  otherUser?: User;
  lastMessage?: string;
  unreadCount?: number;
  isSender?: boolean;
}

export interface PrivateMessage {
  id: string;
  chatId: string;
  senderId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  sender?: User;
  // 发送状态：sending(发送中), sent(已发送), failed(发送失败)
  sendingStatus?: 'sending' | 'sent' | 'failed';
  // 临时ID，用于乐观更新时的消息标识
  tempId?: string;
}

export interface ChatListItem {
  id: string;
  type: 'topic' | 'private';
  title: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  otherUser?: User; // プライベートチャット用
  topic?: Topic;    // トピックチャット用
}

// 标签选择相关接口
export interface TagOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface TagSelection {
  situation?: string;
  mood?: string;
  feature?: string;
}

export interface TagData {
  situation: TagOption[];
  mood: { [key: string]: TagOption[] };
  feature: TagOption[];
}

// 标签显示相关接口
export interface TopicTagsProps {
  tags?: string[];
  onTagPress?: (tag: string) => void;
  maxVisible?: number;
  style?: any;
}

// 标签样式接口
export interface TagStyle {
  backgroundColor: string;
  textColor: string;
  priority: number;
}

// 标签过滤参数接口
export interface TagFilterParams {
  tag: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  maxDistance?: number;
  limit?: number;
}

// 智能推荐接口
export interface SmartRecommendation {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  recommendationType: 'trending' | 'location' | 'social' | 'business';
  imageUrl?: string;
  gradientColors: string[];
  isSponsored: boolean;
  sponsorName?: string;
  targetUrl?: string;
  topicId?: string;
}

// 分类配置接口
export interface CategoryConfig {
  categoryKey: string;
  displayName: string;
  iconEmoji: string;
  colorCode: string;
  commercialPriority: number;
  isActive: boolean;
  sortOrder?: number;
}

// 增强的话题类型
export interface EnhancedTopic extends Topic {
  engagementScore?: number;
  isPromoted?: boolean;
  category?: string;
  recommendationReason?: string;
  contentType?: 'normal' | 'sponsored' | 'challenge';
}

// 挑战活动接口
export interface ChallengeActivity {
  id: string;
  title: string;
  description: string;
  participantCount: number;
  targetParticipantCount: number;
  deadline: string;
  badgeImageUrl?: string;
  challengeTags: string[];
  rules?: string;
  rewardDescription?: string;
}

// 探索页面交互类型
export type ExploreInteractionType = 'view' | 'click' | 'like' | 'share' | 'similar_post' | 'category_click';

// 用户阻止相关接口
export interface BlockedUser {
  blocked_user_id: string;
  blocked_user_name: string;
  blocked_user_avatar: string | null;
  reason: string | null;
  is_mutual: boolean;
  blocked_at: string;
}

export interface BlockStatus {
  is_blocked_by_user1: boolean;
  is_blocked_by_user2: boolean;
  is_any_blocked: boolean;
}

export interface BlockAction {
  action: 'blocked' | 'unblocked';
  is_blocked: boolean;
  is_mutual?: boolean;
}

// 举报系统相关接口
export interface ReportCategory {
  id: string;
  category_key: string;
  display_name_ja: string;
  display_name_en: string;
  description_ja: string | null;
  description_en: string | null;
  requires_details: boolean;
  sort_order: number;
}

export interface UserReport {
  report_id: string;
  reported_user_name: string;
  content_type: 'topic' | 'comment' | 'chat_message' | 'user' | 'private_message';
  category_name: string;
  reason: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'escalated';
  created_at: string;
  resolved_at: string | null;
}

export interface ReportSubmissionResult {
  report_id: string | null;
  success: boolean;
  message: string;
}

export interface ContentReportStatus {
  is_reported: boolean;
  report_status: string | null;
  report_date: string | null;
}

export interface ReportStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
  recentReports: UserReport[];
}

// 年龄验证相关接口
export interface AgeVerificationResult {
  success: boolean;
  age: number;
  message: string;
  requires_parent_consent: boolean;
}

export interface AgeComplianceCheck {
  is_compliant: boolean;
  age: number | null;
  verification_status: boolean;
  verification_date: string | null;
  needs_reverification: boolean;
}

// 增强的用户接口，包含安全相关信息
export interface SafeUser extends User {
  is_blocked?: boolean;
  is_reported?: boolean;
  age_verified?: boolean;
  birth_date?: string;
  verification_method?: 'self_declared' | 'document' | 'parent_consent' | 'credit_card';
}