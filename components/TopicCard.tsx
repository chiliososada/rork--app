import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, MessageCircle, Users, Heart, Bookmark } from 'lucide-react-native';
import { Topic } from '@/types';
import Colors from '@/constants/colors';
import { TopicCardImage } from '@/components/TopicImage';
import { TopicCardAvatar } from '@/components/UserAvatar';
import { useTopicStore } from '@/store/topic-store';
import { useAuthStore } from '@/store/auth-store';

interface TopicCardProps {
  topic: Topic;
}

export default function TopicCard({ topic }: TopicCardProps) {
  const router = useRouter();
  const { toggleFavorite, toggleLike, isFavoriteLoading, isLikeLoading } = useTopicStore();
  const { user } = useAuthStore();
  
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m先`;
    } else {
      return `${(meters / 1000).toFixed(1)}km先`;
    }
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  };
  
  const handlePress = () => {
    router.push(`/topic/${topic.id}`);
  };
  
  const handleFavoritePress = async (e: any) => {
    e.stopPropagation(); // Prevent triggering the topic navigation
    if (user?.id && !isFavoriteLoading) {
      await toggleFavorite(topic.id, user.id);
    }
  };
  
  const handleLikePress = async (e: any) => {
    e.stopPropagation(); // Prevent triggering the topic navigation
    if (user?.id && !isLikeLoading) {
      await toggleLike(topic.id, user.id);
    }
  };
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.authorContainer}>
          <TopicCardAvatar user={topic.author} />
          <Text style={styles.authorName}>{topic.author.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            disabled={isFavoriteLoading}
            activeOpacity={0.7}
          >
            <Bookmark
              size={18}
              color={topic.isFavorited ? '#007AFF' : Colors.text.secondary}
              fill={topic.isFavorited ? '#007AFF' : 'transparent'}
            />
          </TouchableOpacity>
          <Text style={styles.time}>{formatTime(topic.createdAt)}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{topic.title}</Text>
        <Text style={styles.description}>
          {topic.description}
        </Text>
        
        {/* Topic Image */}
        <TopicCardImage topic={topic} />
      </View>
      
      <View style={styles.footer}>
        <View style={styles.locationContainer}>
          <MapPin size={14} color={Colors.text.secondary} />
          <Text style={styles.locationText}>
            {topic.location.name || '不明な場所'} • {formatDistance(topic.distance || 0)}
          </Text>
        </View>
        
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.stat} onPress={handleLikePress} activeOpacity={0.7}>
            <Heart 
              size={14} 
              color={topic.isLiked ? '#FF6B6B' : Colors.text.secondary}
              fill={topic.isLiked ? '#FF6B6B' : 'transparent'}
            />
            <Text style={[styles.statText, topic.isLiked && { color: '#FF6B6B' }]}>
              {topic.likesCount || 0}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.stat}>
            <MessageCircle size={14} color={Colors.text.secondary} />
            <Text style={styles.statText}>{topic.commentCount}</Text>
          </View>
          
          <View style={styles.stat}>
            <Users size={14} color={Colors.text.secondary} />
            <Text style={styles.statText}>{topic.participantCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  favoriteButton: {
    padding: 4,
    borderRadius: 20,
  },
  time: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  content: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  statText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
});