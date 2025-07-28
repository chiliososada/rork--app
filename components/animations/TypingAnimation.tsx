import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface TypingAnimationProps {
  color?: string;
  size?: number;
  style?: any;
}

export default function TypingAnimation({ 
  color = Colors.text.secondary, 
  size = 4,
  style 
}: TypingAnimationProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = createAnimation(dot1, 0);
    const animation2 = createAnimation(dot2, 200);
    const animation3 = createAnimation(dot3, 400);

    Animated.parallel([animation1, animation2, animation3]).start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  const animatedStyle = (animatedValue: Animated.Value) => ({
    opacity: animatedValue,
    transform: [
      {
        scale: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        }),
      },
    ],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
          animatedStyle(dot1),
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
          animatedStyle(dot2),
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
          animatedStyle(dot3),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    marginHorizontal: 1,
  },
});