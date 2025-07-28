import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Send } from 'lucide-react-native';
import Colors from '@/constants/colors';
import InputContainer from './InputContainer';
import SpinningIndicator from '@/components/animations/SpinningIndicator';

interface CommentInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  maxLength?: number;
  showCharacterCount?: boolean;
  autoFocus?: boolean;
}

export default function CommentInput({
  value,
  onChangeText,
  onSend,
  placeholder = "コメントを追加...",
  disabled = false,
  isSending = false,
  maxLength = 500,
  showCharacterCount = false,
  autoFocus = false,
}: CommentInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);
  const focusAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  const canSend = value.trim().length > 0 && !disabled && !isSending;
  const isNearLimit = value.length > maxLength * 0.8; 
  const isOverLimit = value.length > maxLength;

  useEffect(() => {
    Animated.timing(focusAnimation, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleSend = async () => {
    if (!canSend) return;

    // 送信ボタンのアニメーション
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    await onSend();
  };

  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    const newHeight = Math.min(Math.max(height, 44), 100); // 最小44px、最大100px（チャットより少し小さく）
    setInputHeight(newHeight);
  };

  const borderColor = focusAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E0E0E0', '#007AFF'],
  });

  const backgroundOpacity = focusAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <InputContainer
      backgroundColor="#FAFAFA"
      borderTopColor="#E8E8E8"
      borderTopWidth={1}
    >
      <View style={styles.inputWrapper}>
        <Animated.View
          style={[
            styles.inputContainer,
            {
              borderColor,
              backgroundColor: backgroundOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 1)'],
              }),
              height: inputHeight,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                height: inputHeight - 2, // border分を引く
                color: isOverLimit ? Colors.error : Colors.text.primary,
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor="#999999"
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onContentSizeChange={handleContentSizeChange}
            multiline
            selectionColor="#007AFF"
            editable={!disabled}
            maxLength={maxLength}
            textAlignVertical="center"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
        </Animated.View>

        {/* 文字数カウンター */}
        {showCharacterCount && (isNearLimit || isFocused) && (
          <Text
            style={[
              styles.characterCount,
              isOverLimit && styles.characterCountError,
            ]}
          >
            {value.length}/{maxLength}
          </Text>
        )}
      </View>

      <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {isSending ? (
            <SpinningIndicator size={20} color={Colors.text.light} />
          ) : (
            <Send size={20} color={Colors.text.light} />
          )}
        </TouchableOpacity>
      </Animated.View>
    </InputContainer>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    lineHeight: 20,
  },
  characterCount: {
    position: 'absolute',
    right: 8,
    bottom: -20,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  characterCountError: {
    color: Colors.error,
    fontWeight: '600',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowColor: '#C7C7CC',
    shadowOpacity: 0.1,
    elevation: 2,
  },
});