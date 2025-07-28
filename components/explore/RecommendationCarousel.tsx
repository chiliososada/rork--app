import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SmartRecommendation } from '@/types';
import Colors from '@/constants/colors';
import { Sparkles, TrendingUp, MapPin, Users } from 'lucide-react-native';

interface RecommendationCarouselProps {
  recommendations: SmartRecommendation[];
  isLoading: boolean;
  onRecommendationPress?: (recommendation: SmartRecommendation) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.85;
const CARD_SPACING = 12;

export default function RecommendationCarousel({ 
  recommendations, 
  isLoading,
  onRecommendationPress 
}: RecommendationCarouselProps) {
  const router = useRouter();
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'trending':
        return <TrendingUp size={20} color="#fff" />;
      case 'location':
        return <MapPin size={20} color="#fff" />;
      case 'social':
        return <Users size={20} color="#fff" />;
      default:
        return <Sparkles size={20} color="#fff" />;
    }
  };
  
  const handlePress = async (recommendation: SmartRecommendation) => {
    if (onRecommendationPress) {
      onRecommendationPress(recommendation);
    }
    
    if (recommendation.topicId) {
      router.push(`/topic/${recommendation.topicId}`);
    } else if (recommendation.targetUrl && recommendation.targetUrl.trim()) {
      let url = recommendation.targetUrl.trim();
      
      // URLにプロトコルがない場合はhttpsを追加
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      console.log('Opening URL:', url);
      
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.warn('URL開く際の警告:', {
          originalUrl: recommendation.targetUrl,
          processedUrl: url,
          error: error.message
        });
        
        // 開発環境でのエラーの場合はアラートを表示しない
        // 実際のデバイスでテストが必要
        if (__DEV__) {
          console.log('開発環境でのLinking.openURLエラー - 実際にはURLが開かれている可能性があります');
        } else {
          Alert.alert('エラー', 'リンクを開くことができませんでした');
        }
      }
    }
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }
  
  if (!recommendations || recommendations.length === 0) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Sparkles size={20} color={Colors.primary} />
        <Text style={styles.title}>あなたにおすすめ</Text>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
      >
        {recommendations.map((recommendation) => (
          <TouchableOpacity
            key={recommendation.id}
            style={styles.card}
            onPress={() => handlePress(recommendation)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={recommendation.gradientColors}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  {getIcon(recommendation.recommendationType)}
                  {recommendation.isSponsored && (
                    <View style={styles.sponsoredBadge}>
                      <Text style={styles.sponsoredText}>PR</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {recommendation.title}
                </Text>
                
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {recommendation.subtitle}
                </Text>
                
                {recommendation.description && (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {recommendation.description}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  loadingContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: 160,
    marginRight: CARD_SPACING,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    padding: 20,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sponsoredText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    lineHeight: 16,
  },
});