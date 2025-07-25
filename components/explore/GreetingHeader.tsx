import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface GreetingHeaderProps {
  locationName?: string;
  topicCount?: number;
}

export default function GreetingHeader({ locationName, topicCount }: GreetingHeaderProps) {
  const [greeting, setGreeting] = useState('こんにちは！');
  
  useEffect(() => {
    // 获取时间感知的问候语
    const fetchGreeting = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_time_greeting');
          
        if (!error && data) {
          setGreeting(data);
        }
      } catch (error) {
        console.error('Failed to fetch greeting:', error);
      }
    };
    
    fetchGreeting();
    
    // 每分钟更新一次问候语
    const interval = setInterval(fetchGreeting, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const getSubtitle = () => {
    if (locationName && topicCount !== undefined) {
      return `📍 ${locationName}周辺で${topicCount}件の話題を発見`;
    } else if (locationName) {
      return `📍 ${locationName}周辺を探索中`;
    } else {
      return '🌟 今日も新しい発見がありますように';
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.subtitle}>{getSubtitle()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
});