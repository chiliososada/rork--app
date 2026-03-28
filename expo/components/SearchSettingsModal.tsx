import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Minus, Plus } from 'lucide-react-native';
import Button from './Button';
import Colors from '@/constants/colors';
import { 
  useSearchSettingsStore, 
  TimeRange, 
  getTimeRangeLabel, 
  getRadiusLabel 
} from '@/store/search-settings-store';

interface SearchSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

const TIME_RANGE_OPTIONS: TimeRange[] = ['today', 'week', 'month', 'all'];

export default function SearchSettingsModal({ 
  visible, 
  onClose, 
  onSettingsChanged 
}: SearchSettingsModalProps) {
  const { settings, updateRadius, updateTimeRange, resetToDefaults } = useSearchSettingsStore();
  const [tempRadius, setTempRadius] = useState(settings.radiusKm);
  const [tempTimeRange, setTempTimeRange] = useState(settings.timeRange);

  const handleSave = () => {
    updateRadius(tempRadius);
    updateTimeRange(tempTimeRange);
    onSettingsChanged();
    onClose();
  };

  const handleReset = () => {
    Alert.alert(
      '設定をリセット',
      'すべての検索設定をデフォルト値に戻しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: 'リセット', 
          style: 'destructive',
          onPress: () => {
            resetToDefaults();
            setTempRadius(5);
            setTempTimeRange('all');
            onSettingsChanged();
          }
        },
      ]
    );
  };

  const handleClose = () => {
    // Reset temp values to current settings when closing without saving
    setTempRadius(settings.radiusKm);
    setTempTimeRange(settings.timeRange);
    onClose();
  };

  const decreaseRadius = () => {
    setTempRadius(Math.max(1, tempRadius - 1));
  };

  const increaseRadius = () => {
    setTempRadius(Math.min(50, tempRadius + 1));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>検索設定</Text>
          <TouchableOpacity 
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Search Radius Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>検索範囲</Text>
            <Text style={styles.sectionDescription}>
              現在地から半径何キロメートル以内のトピックを表示するかを設定します
            </Text>
            
            <View style={styles.radiusControl}>
              <TouchableOpacity 
                onPress={decreaseRadius}
                style={[styles.radiusButton, tempRadius <= 1 && styles.disabledButton]}
                disabled={tempRadius <= 1}
              >
                <Minus size={20} color={tempRadius <= 1 ? Colors.text.disabled : Colors.primary} />
              </TouchableOpacity>
              
              <View style={styles.radiusDisplay}>
                <Text style={styles.radiusValue}>{tempRadius}</Text>
                <Text style={styles.radiusUnit}>km</Text>
              </View>
              
              <TouchableOpacity 
                onPress={increaseRadius}
                style={[styles.radiusButton, tempRadius >= 50 && styles.disabledButton]}
                disabled={tempRadius >= 50}
              >
                <Plus size={20} color={tempRadius >= 50 ? Colors.text.disabled : Colors.primary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.radiusLabel}>
              {getRadiusLabel(tempRadius)}の範囲でトピックを検索
            </Text>
          </View>

          {/* Time Range Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>期間フィルター</Text>
            <Text style={styles.sectionDescription}>
              どの期間のトピックを表示するかを選択します
            </Text>
            
            <View style={styles.timeRangeGrid}>
              {TIME_RANGE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.timeRangeOption,
                    tempTimeRange === option && styles.timeRangeOptionSelected
                  ]}
                  onPress={() => setTempTimeRange(option)}
                >
                  <Text style={[
                    styles.timeRangeText,
                    tempTimeRange === option && styles.timeRangeTextSelected
                  ]}>
                    {getTimeRangeLabel(option)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="リセット"
            onPress={handleReset}
            variant="outline"
            style={styles.resetButton}
          />
          <Button
            title="保存"
            onPress={handleSave}
            style={styles.saveButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  radiusControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  radiusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(91, 114, 242, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  radiusDisplay: {
    alignItems: 'center',
    marginHorizontal: 32,
  },
  radiusValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  radiusUnit: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: -4,
  },
  radiusLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.text.secondary,
  },
  timeRangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeRangeOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: 80,
    alignItems: 'center',
  },
  timeRangeOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(91, 114, 242, 0.1)',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  timeRangeTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});