import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps
} from 'react-native';
import Colors from '@/constants/colors';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  const getButtonStyle = () => {
    let buttonStyle: ViewStyle = {};
    
    // Variant styles
    switch (variant) {
      case 'primary':
        buttonStyle.backgroundColor = Colors.primary;
        break;
      case 'secondary':
        buttonStyle.backgroundColor = Colors.secondary;
        break;
      case 'outline':
        buttonStyle.backgroundColor = 'transparent';
        buttonStyle.borderWidth = 1;
        buttonStyle.borderColor = Colors.primary;
        break;
    }
    
    // Size styles
    switch (size) {
      case 'small':
        buttonStyle.paddingVertical = 8;
        buttonStyle.paddingHorizontal = 16;
        break;
      case 'medium':
        buttonStyle.paddingVertical = 12;
        buttonStyle.paddingHorizontal = 24;
        break;
      case 'large':
        buttonStyle.paddingVertical = 16;
        buttonStyle.paddingHorizontal = 32;
        break;
    }
    
    // Disabled style
    if (disabled || isLoading) {
      buttonStyle.opacity = 0.6;
    }
    
    return buttonStyle;
  };
  
  const getTextStyle = () => {
    let textStyle: TextStyle = {};
    
    // Variant text styles
    switch (variant) {
      case 'primary':
      case 'secondary':
        textStyle.color = Colors.text.light;
        break;
      case 'outline':
        textStyle.color = Colors.primary;
        break;
    }
    
    // Size text styles
    switch (size) {
      case 'small':
        textStyle.fontSize = 14;
        break;
      case 'medium':
        textStyle.fontSize = 16;
        break;
      case 'large':
        textStyle.fontSize = 18;
        break;
    }
    
    return textStyle;
  };
  
  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator 
          color={variant === 'outline' ? Colors.primary : Colors.text.light} 
          size="small" 
        />
      ) : (
        <Text style={[styles.text, getTextStyle(), textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});