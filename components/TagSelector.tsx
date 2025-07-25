import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { TagData, TagSelection, TagOption } from '@/types';
import Colors from '@/constants/colors';

interface TagSelectorProps {
  onTagsChange: (tags: string[]) => void;
  selectedTags?: string[];
}

// 预定义标签数据
const TAG_DATA: TagData = {
  situation: [
    { id: 'eating', label: '食事中', emoji: '🍽️' },
    { id: 'traveling', label: '移動中', emoji: '🚶' },
    { id: 'working', label: '仕事中', emoji: '💼' },
    { id: 'resting', label: '休憩中', emoji: '☕' },
    { id: 'shopping', label: '買い物', emoji: '🛍️' },
    { id: 'studying', label: '勉強中', emoji: '📚' },
    { id: 'exercising', label: '運動中', emoji: '🏃' },
    { id: 'event', label: 'イベント', emoji: '🎉' }
  ],
  mood: {
    eating: [
      { id: 'delicious', label: '美味しい' },
      { id: 'discovery', label: '新発見' },
      { id: 'together', label: 'みんなで' },
      { id: 'cost-effective', label: 'コスパ良い' }
    ],
    traveling: [
      { id: 'exploring', label: '探索中' },
      { id: 'commuting', label: '通勤中' },
      { id: 'adventure', label: '冒険' },
      { id: 'relaxing-trip', label: 'のんびり' }
    ],
    working: [
      { id: 'motivated', label: '頑張ってる' },
      { id: 'busy', label: '忙しい' },
      { id: 'break', label: '一息' },
      { id: 'meeting', label: '打ち合わせ' }
    ],
    resting: [
      { id: 'peaceful', label: 'のんびり' },
      { id: 'tired', label: '疲れた' },
      { id: 'relaxed', label: 'リラックス' },
      { id: 'refreshing', label: 'リフレッシュ' }
    ],
    shopping: [
      { id: 'hunting', label: '探し物' },
      { id: 'found-deal', label: 'お得発見' },
      { id: 'browsing', label: 'ぶらぶら' },
      { id: 'necessity', label: '必要な物' }
    ],
    studying: [
      { id: 'focused', label: '集中中' },
      { id: 'struggling', label: '苦戦中' },
      { id: 'learning', label: '学習中' },
      { id: 'exam-prep', label: '試験勉強' }
    ],
    exercising: [
      { id: 'energetic', label: '元気' },
      { id: 'challenging', label: 'チャレンジ' },
      { id: 'healthy', label: '健康的' },
      { id: 'training', label: 'トレーニング' }
    ],
    event: [
      { id: 'exciting', label: 'ワクワク' },
      { id: 'crowded', label: 'にぎやか' },
      { id: 'memorable', label: '思い出' },
      { id: 'special', label: '特別' }
    ]
  },
  feature: [
    { id: 'near-station', label: '駅近' },
    { id: 'quiet', label: '静か' },
    { id: 'stylish', label: 'おしゃれ' },
    { id: 'hidden-gem', label: '穴場' },
    { id: 'lively', label: 'にぎやか' },
    { id: 'new', label: '新しい' }
  ]
};

export default function TagSelector({ onTagsChange, selectedTags = [] }: TagSelectorProps) {
  const [selection, setSelection] = useState<TagSelection>({});
  const [showMoodLayer, setShowMoodLayer] = useState(false);
  const [showFeatureLayer, setShowFeatureLayer] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // 初始化已选择的标签
  useEffect(() => {
    if (selectedTags.length > 0) {
      const initSelection: TagSelection = {};
      
      // 查找情境标签
      const situationTag = TAG_DATA.situation.find(tag => selectedTags.includes(tag.label));
      if (situationTag) {
        initSelection.situation = situationTag.id;
        setShowMoodLayer(true);
        
        // 查找心情标签
        const moodTags = TAG_DATA.mood[situationTag.id] || [];
        const moodTag = moodTags.find(tag => selectedTags.includes(tag.label));
        if (moodTag) {
          initSelection.mood = moodTag.id;
        }
      }
      
      // 查找特征标签
      const featureTag = TAG_DATA.feature.find(tag => selectedTags.includes(tag.label));
      if (featureTag) {
        initSelection.feature = featureTag.id;
        setShowFeatureLayer(true);
      }
      
      setSelection(initSelection);
    }
  }, []);

  // 更新标签变化
  useEffect(() => {
    const tags: string[] = [];
    
    if (selection.situation) {
      const situationTag = TAG_DATA.situation.find(tag => tag.id === selection.situation);
      if (situationTag) tags.push(situationTag.label);
    }
    
    if (selection.mood && selection.situation) {
      const moodTags = TAG_DATA.mood[selection.situation] || [];
      const moodTag = moodTags.find(tag => tag.id === selection.mood);
      if (moodTag) tags.push(moodTag.label);
    }
    
    if (selection.feature) {
      const featureTag = TAG_DATA.feature.find(tag => tag.id === selection.feature);
      if (featureTag) tags.push(featureTag.label);
    }
    
    onTagsChange(tags);
  }, [selection, onTagsChange]);

  const handleSituationSelect = (situationId: string) => {
    const newSelection = { 
      ...selection, 
      situation: selection.situation === situationId ? undefined : situationId,
      mood: selection.situation === situationId ? selection.mood : undefined // 保持心情选择，除非取消情境
    };
    
    setSelection(newSelection);
    
    if (newSelection.situation) {
      setShowMoodLayer(true);
      setShowFeatureLayer(true);
      animateLayerIn();
    } else {
      setShowMoodLayer(false);
      setShowFeatureLayer(false);
    }
  };

  const handleMoodSelect = (moodId: string) => {
    setSelection(prev => ({
      ...prev,
      mood: prev.mood === moodId ? undefined : moodId
    }));
  };

  const handleFeatureSelect = (featureId: string) => {
    setSelection(prev => ({
      ...prev,
      feature: prev.feature === featureId ? undefined : featureId
    }));
  };

  const animateLayerIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const renderTagOption = (
    option: TagOption, 
    isSelected: boolean, 
    onPress: () => void,
    showEmoji: boolean = false
  ) => (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.tagButton,
        isSelected && styles.tagButtonSelected
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.tagButtonText,
        isSelected && styles.tagButtonTextSelected
      ]}>
        {showEmoji && option.emoji ? `${option.emoji} ${option.label}` : option.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏷️ あなたの投稿をもっと見つけやすくしましょう</Text>
        <Text style={styles.subtitle}>最大3つのタグを選択できます</Text>
      </View>

      {/* 第一层：情境标签 */}
      <View style={styles.layerContainer}>
        <Text style={styles.layerTitle}>今何をしていますか？</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagScrollContainer}
        >
          {TAG_DATA.situation.map(option => 
            renderTagOption(
              option,
              selection.situation === option.id,
              () => handleSituationSelect(option.id),
              true
            )
          )}
        </ScrollView>
      </View>

      {/* 第二层：心情标签 */}
      {showMoodLayer && selection.situation && (
        <Animated.View style={[styles.layerContainer, { opacity: fadeAnim }]}>
          <Text style={styles.layerTitle}>どんな気分ですか？</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagScrollContainer}
          >
            {(TAG_DATA.mood[selection.situation] || []).map(option => 
              renderTagOption(
                option,
                selection.mood === option.id,
                () => handleMoodSelect(option.id)
              )
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* 第三层：特征标签 */}
      {showFeatureLayer && (
        <Animated.View style={[styles.layerContainer, { opacity: fadeAnim }]}>
          <Text style={styles.layerTitle}>この場所の特徴は？</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagScrollContainer}
          >
            {TAG_DATA.feature.map(option => 
              renderTagOption(
                option,
                selection.feature === option.id,
                () => handleFeatureSelect(option.id)
              )
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* 已选择标签预览 */}
      {(selection.situation || selection.mood || selection.feature) && (
        <View style={styles.selectedTagsContainer}>
          <Text style={styles.selectedTagsTitle}>選択したタグ:</Text>
          <View style={styles.selectedTagsList}>
            {selection.situation && (
              <View style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>
                  {TAG_DATA.situation.find(tag => tag.id === selection.situation)?.label}
                </Text>
              </View>
            )}
            {selection.mood && selection.situation && (
              <View style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>
                  {TAG_DATA.mood[selection.situation]?.find(tag => tag.id === selection.mood)?.label}
                </Text>
              </View>
            )}
            {selection.feature && (
              <View style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>
                  {TAG_DATA.feature.find(tag => tag.id === selection.feature)?.label}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  layerContainer: {
    marginBottom: 20,
  },
  layerTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  tagScrollContainer: {
    paddingHorizontal: 0,
    gap: 8,
  },
  tagButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44, // 确保足够的触摸目标大小
  },
  tagButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  tagButtonTextSelected: {
    color: Colors.text.light,
  },
  selectedTagsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  selectedTagsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  selectedTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.light,
  },
});