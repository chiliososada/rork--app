import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, TrendingUp, MapPin, Clock, User, Plus, ChevronDown, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocationStore } from '@/store/location-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { Tag, TagRecommendation, TagCategoryMap } from '@/types/tag';

interface SmartTagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
}

// カテゴリー設定
const TAG_CATEGORIES: TagCategoryMap = {
  personal: { icon: User, color: '#3B82F6', label: 'あなたの履歴' },
  location: { icon: MapPin, color: '#10B981', label: '近くで人気' },
  time: { icon: Clock, color: '#F59E0B', label: '今の時間帯' },
  popular: { icon: TrendingUp, color: '#EF4444', label: 'トレンド' },
};

export default function SmartTagSelector({
  selectedTags,
  onTagsChange,
  maxTags = 5,
}: SmartTagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<Tag[]>([]);
  const [recommendations, setRecommendations] = useState<TagRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const { currentLocation } = useLocationStore();
  const { user } = useAuthStore();
  const fadeAnim = new Animated.Value(1); // 初期値を1に設定して即座に表示
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  
  // 折りたたみ状態管理
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    personal: true,    // あなたの履歴は常に展開
    location: false,   // 近くで人気は折りたたみ
    time: false,       // 今の時間帯は折りたたみ  
    popular: false,    // トレンドは折りたたみ
  });

  // 初期推薦タグを取得
  useEffect(() => {
    if (user?.id && currentLocation) {
      fetchRecommendations();
    }
  }, [user?.id, currentLocation]);

  // コンポーネントアンマウント時にタイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
    };
  }, [searchTimer]);

  // 推薦タグ取得
  const fetchRecommendations = async () => {
    if (!user?.id || !currentLocation) {
      return;
    }

    setIsLoading(true);
    try {

      const { data, error } = await supabase.rpc('get_smart_tag_recommendations', {
        user_id_param: user.id,
        user_lat: currentLocation.latitude,
        user_lng: currentLocation.longitude,
        limit_count: 20,
      });


      if (!error && data) {
        // データベースのフィールド名をTypeScript型に合わせて変換
        const formattedRecommendations = data.map((item: { tag_name: string; recommendation_type: string; score: number }) => ({
          tagName: item.tag_name,
          recommendationType: item.recommendation_type,
          score: item.score
        }));
        
        setRecommendations(formattedRecommendations);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else if (error) {
        console.error('[SmartTagSelector] Error fetching recommendations:', error);
      }
    } catch (error) {
      console.error('[SmartTagSelector] Exception fetching recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // タグ検索（デバウンス処理）
  const searchTags = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_tags', {
        search_query: query,
        user_id_param: user?.id,
        limit_count: 10,
      });

      if (!error && data) {
        // タイプ変換とフィルタリング
        const formattedResults = data
          .filter((item: { tag_name: string; source: string; usage_count: number; relevance_score: number }) => !selectedTags.includes(item.tag_name))
          .map((item: { tag_name: string; source: string; usage_count: number; relevance_score: number }) => ({
            name: item.tag_name,
            source: item.source,
            usageCount: item.usage_count,
            relevanceScore: item.relevance_score,
          }));
        setSearchResults(formattedResults);
      }
    } catch (error) {
      console.error('Error searching tags:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 入力値変更処理（デバウンス付き）
  const handleInputChange = (text: string) => {
    setInputValue(text);
    
    // 既存のタイマーをクリア
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    // 新しいタイマーを設定
    const newTimer = setTimeout(() => {
      searchTags(text);
    }, 300);
    
    setSearchTimer(newTimer);
  };

  // タグ追加処理
  const handleAddTag = (tagName: string) => {
    if (selectedTags.length >= maxTags) {
      // TODO: より良いアラート実装
      alert(`最大${maxTags}個までタグを選択できます`);
      return;
    }

    if (!selectedTags.includes(tagName)) {
      onTagsChange([...selectedTags, tagName]);
      setInputValue('');
      setSearchResults([]);
      setShowInput(false);
      Keyboard.dismiss();
    }
  };

  // タグ削除処理
  const handleRemoveTag = (tagName: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagName));
  };

  // カスタムタグ追加
  const handleAddCustomTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !selectedTags.includes(trimmedValue)) {
      handleAddTag(trimmedValue);
    }
  };

  // カテゴリー展開/折りたたみ制御
  const toggleCategory = (categoryType: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryType]: !prev[categoryType]
    }));
  };

  // 推薦タグの動的フィルタリング関数
  const filterRecommendationsByInput = (recommendations: TagRecommendation[], query: string) => {
    if (!query.trim()) {
      return recommendations; // 入力がない場合は全て表示
    }
    
    const lowerQuery = query.toLowerCase();
    return recommendations.filter(rec => {
      const tagName = rec.tagName.toLowerCase();
      // 前方一致 + 部分一致で絞り込み
      return tagName.includes(lowerQuery);
    });
  };

  // 推薦タグをカテゴリー別にグループ化し、優先度と入力でフィルタリング
  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    if (!acc[rec.recommendationType]) {
      acc[rec.recommendationType] = [];
    }
    // 既に選択されているタグは除外、スコア0のタグも除外（ただしpersonalは除く）
    if (!selectedTags.includes(rec.tagName) && 
        (rec.recommendationType === 'personal' || rec.score > 0)) {
      acc[rec.recommendationType].push(rec);
    }
    return acc;
  }, {} as Record<string, TagRecommendation[]>);

  // 入力値に基づいて各カテゴリーの推薦タグを動的フィルタリング
  const filteredGroupedRecommendations = Object.entries(groupedRecommendations).reduce((acc, [type, tags]) => {
    const filteredTags = filterRecommendationsByInput(tags, inputValue);
    if (filteredTags.length > 0) {
      acc[type] = filteredTags;
    }
    return acc;
  }, {} as Record<string, TagRecommendation[]>);

  // 各カテゴリーをスコア順にソートし、表示数を制限
  const getDisplayTags = (tags: TagRecommendation[], categoryType: string, isExpanded: boolean) => {
    const sortedTags = [...tags].sort((a, b) => b.score - a.score);
    const maxDisplay = isExpanded ? 8 : 3; // 展開時は8個、折りたたみ時は3個
    return sortedTags.slice(0, maxDisplay);
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 選択済みタグ */}
      {selectedTags.length > 0 && (
        <View style={styles.selectedTagsContainer}>
          <Text style={styles.sectionTitle}>選択中のタグ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.selectedTags}>
              {selectedTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={styles.selectedTag}
                  onPress={() => handleRemoveTag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectedTagText}>{tag}</Text>
                  <X size={14} color="#FFF" style={styles.removeIcon} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* タグ入力エリア */}
      <View style={styles.inputSection}>
        <TouchableOpacity
          style={styles.addTagButton}
          onPress={() => setShowInput(!showInput)}
          activeOpacity={0.7}
        >
          <Plus size={16} color={Colors.text.secondary} />
          <Text style={styles.addTagButtonText}>
            タグを追加 ({selectedTags.length}/{maxTags})
          </Text>
        </TouchableOpacity>

        {showInput && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={handleInputChange}
                placeholder="タグを入力..."
                placeholderTextColor={Colors.text.secondary}
                returnKeyType="done"
                onSubmitEditing={handleAddCustomTag}
                autoFocus
              />
              {inputValue.trim() && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddCustomTag}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>追加</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 検索結果 */}
            {(searchResults.length > 0 || isSearching) && (
              <View style={styles.searchResults}>
                {isSearching ? (
                  <View style={styles.searchingContainer}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.searchingText}>検索中...</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {searchResults.map((result, index) => (
                      <TouchableOpacity
                        key={`${result.name}-${index}`}
                        style={styles.searchResultItem}
                        onPress={() => handleAddTag(result.name)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.searchResultContent}>
                          <Text style={styles.searchResultText}>{result.name}</Text>
                          <View style={styles.searchResultMeta}>
                            <Text style={styles.searchResultSource}>
                              {result.source === 'preset' && 'おすすめ'}
                              {result.source === 'custom' && 'みんなが作成'}
                              {result.source === 'user_history' && 'あなたの履歴'}
                            </Text>
                            <Text style={styles.searchResultCount}>
                              {result.usageCount}回使用
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* 推薦タグ */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>おすすめを読み込み中...</Text>
        </View>
      ) : (
        <Animated.ScrollView 
          style={[styles.recommendationsContainer, { opacity: fadeAnim }]}
          showsVerticalScrollIndicator={false}
        >
          {/* 入力値があるがフィルタリング結果が0件の場合のメッセージ */}
          {inputValue.trim() && Object.keys(filteredGroupedRecommendations).length === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                「{inputValue}」に一致する推薦タグはありません
              </Text>
              <Text style={styles.noResultsSubtext}>
                上記の検索結果から選択するか、新しいタグを追加してください
              </Text>
            </View>
          )}
          
          {Object.entries(filteredGroupedRecommendations).map(([type, tags]) => {
            const category = TAG_CATEGORIES[type as keyof typeof TAG_CATEGORIES];
            if (!category || tags.length === 0) {
              return null;
            }

            const Icon = category.icon;
            const isExpanded = expandedCategories[type];
            const displayTags = getDisplayTags(tags, type, isExpanded);
            const hasMoreTags = tags.length > displayTags.length;

            return (
              <View key={type} style={styles.recommendationSection}>
                <TouchableOpacity 
                  style={styles.recommendationHeader}
                  onPress={() => toggleCategory(type)}
                  activeOpacity={0.7}
                >
                  <Icon size={14} color={category.color} />
                  <Text style={[styles.recommendationTitle, { color: category.color }]}>
                    {category.label}
                  </Text>
                  <Text style={styles.tagCount}>({tags.length})</Text>
                  <View style={styles.expandIcon}>
                    {isExpanded ? (
                      <ChevronDown size={16} color={Colors.text.secondary} />
                    ) : (
                      <ChevronRight size={16} color={Colors.text.secondary} />
                    )}
                  </View>
                </TouchableOpacity>
                
                {(isExpanded || type === 'personal') && (
                  <>
                    <View style={styles.recommendationTags}>
                      {displayTags.map((tag, index) => (
                        <TouchableOpacity
                          key={`${tag.tagName}-${index}`}
                          style={[
                            styles.recommendationTag,
                            { backgroundColor: category.color + '10', borderColor: category.color + '30' }
                          ]}
                          onPress={() => handleAddTag(tag.tagName)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.recommendationTagText,
                              { color: category.color }
                            ]}
                          >
                            {tag.tagName}
                          </Text>
                          {tag.score > 0 && (
                            <Text style={styles.tagScore}>
                              {tag.score.toFixed(1)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    {hasMoreTags && !isExpanded && (
                      <TouchableOpacity 
                        style={styles.showMoreButton}
                        onPress={() => toggleCategory(type)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.showMoreText, { color: category.color }]}>
                          他{tags.length - displayTags.length}個を表示...
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </Animated.ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectedTagsContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  selectedTags: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  selectedTagText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  removeIcon: {
    marginLeft: 2,
  },
  inputSection: {
    marginBottom: 16,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    gap: 6,
  },
  addTagButtonText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.card,
  },
  addButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  searchResults: {
    maxHeight: 200,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  searchResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  searchResultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultSource: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  searchResultCount: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  recommendationsContainer: {
    flex: 1,
  },
  recommendationSection: {
    marginBottom: 20,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingVertical: 4,
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  tagCount: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  expandIcon: {
    marginLeft: 8,
  },
  recommendationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  recommendationTagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagScore: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginLeft: 4,
    opacity: 0.7,
  },
  showMoreButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    fontSize: 11,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});