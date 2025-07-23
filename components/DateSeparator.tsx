import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface DateSeparatorProps {
  dateString: string;
}

export default function DateSeparator({ dateString }: DateSeparatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{dateString}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.3,
  },
  dateContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.8,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});