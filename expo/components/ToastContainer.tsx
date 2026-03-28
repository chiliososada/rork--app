import React from 'react';
import { View, StyleSheet } from 'react-native';
import Toast from './Toast';
import { useToasts, useToast } from '@/hooks/useToast';

export default function ToastContainer() {
  const toasts = useToasts();
  const { hide } = useToast();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast, index) => (
        <View
          key={toast.id}
          style={[
            styles.toastWrapper,
            { top: 60 + index * 80 } // Stack toasts vertically
          ]}
        >
          <Toast
            {...toast}
            visible={true}
            onClose={() => hide(toast.id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});