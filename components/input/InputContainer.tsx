import React, { ReactNode } from 'react';
import { 
  View, 
  KeyboardAvoidingView, 
  Platform, 
  StyleSheet,
  ViewStyle 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InputContainerProps {
  children: ReactNode;
  backgroundColor?: string;
  borderTopColor?: string;
  borderTopWidth?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export default function InputContainer({
  children,
  backgroundColor = '#FAFAFA',
  borderTopColor = '#E8E8E8',
  borderTopWidth = 1,
  style,
  contentContainerStyle
}: InputContainerProps) {
  const insets = useSafeAreaInsets();

  const getKeyboardVerticalOffset = () => {
    if (Platform.OS === 'ios') {
      // iOS では Header の高さを考慮（約 90-100px）
      return 90;
    } else {
      // Android では StatusBar の高さを考慮
      return 0;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={getKeyboardVerticalOffset()}
      style={[styles.keyboardAvoid, style]}
    >
      <View 
        style={[
          styles.container,
          {
            backgroundColor,
            borderTopColor,
            borderTopWidth,
            paddingBottom: Math.max(insets.bottom, 16), // Safe Area を考慮
          },
          contentContainerStyle
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    // KeyboardAvoidingView のスタイルは最小限に
  },
  container: {
    flexDirection: "row",
    padding: 16,
    alignItems: "flex-end",
    minHeight: 76, // 最小高さを確保
  },
});