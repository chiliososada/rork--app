import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface SpinningIndicatorProps {
  size?: number;
  color?: string;
  borderWidth?: number;
  style?: any;
}

export default function SpinningIndicator({ 
  size = 20, 
  color = '#FFFFFF',
  borderWidth = 2,
  style 
}: SpinningIndicatorProps) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    spin.start();

    return () => spin.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.spinner,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate }],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  spinner: {
    // Base styles handled in component
  },
});