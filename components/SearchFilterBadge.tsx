import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface SearchFilterBadgeProps {
  label: string;
  onRemove?: () => void;
  variant?: 'default' | 'active' | 'inactive';
  onPress?: () => void;
}

export default function SearchFilterBadge({ 
  label, 
  onRemove, 
  variant = 'default',
  onPress
}: SearchFilterBadgeProps) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'active':
        return {
          backgroundColor: Colors.primary,
          borderColor: Colors.primary,
        };
      case 'inactive':
        return {
          backgroundColor: Colors.background,
          borderColor: Colors.border,
        };
      default:
        return {
          backgroundColor: 'rgba(91, 114, 242, 0.1)',
          borderColor: 'rgba(91, 114, 242, 0.2)',
        };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'active':
        return { color: Colors.text.light };
      case 'inactive':
        return { color: Colors.text.secondary };
      default:
        return { color: Colors.primary };
    }
  };

  const BadgeContent = (
    <View style={[styles.badge, getBadgeStyle()]}>
      <Text style={[styles.label, getTextStyle()]}>{label}</Text>
      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X 
            size={14} 
            color={variant === 'active' ? Colors.text.light : Colors.text.secondary} 
          />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {BadgeContent}
      </TouchableOpacity>
    );
  }

  return BadgeContent;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    marginLeft: 6,
    padding: 2,
  },
});