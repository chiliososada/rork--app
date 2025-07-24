import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Settings } from 'lucide-react-native';
import SearchFilterBadge from './SearchFilterBadge';
import Colors from '@/constants/colors';
import { useSearchSettingsStore, getRadiusLabel, getTimeRangeLabel } from '@/store/search-settings-store';

interface SearchFilterBarProps {
  onSettingsPress: () => void;
}

export default function SearchFilterBar({ onSettingsPress }: SearchFilterBarProps) {
  const { settings } = useSearchSettingsStore();

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SearchFilterBadge 
          label={getRadiusLabel(settings.radiusKm)}
          onPress={onSettingsPress}
        />
        
        {settings.timeRange !== 'all' && (
          <SearchFilterBadge 
            label={getTimeRangeLabel(settings.timeRange)}
            onPress={onSettingsPress}
          />
        )}
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={onSettingsPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Settings size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scrollContent: {
    alignItems: 'center',
  },
  settingsButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});