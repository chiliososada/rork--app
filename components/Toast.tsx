import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: screenWidth } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  visible: boolean;
  onClose: () => void;
}

export default function Toast({
  type,
  title,
  message,
  duration = 3000,
  visible,
  onClose,
}: ToastProps) {
  const slideAnim = new Animated.Value(-100);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      // Slide in animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);

        return () => clearTimeout(timer);
      }
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#D4EDDA',
          borderColor: '#C3E6CB',
          textColor: '#155724',
          icon: <CheckCircle size={20} color="#28A745" />,
        };
      case 'error':
        return {
          backgroundColor: '#F8D7DA',
          borderColor: '#F5C6CB',
          textColor: '#721C24',
          icon: <XCircle size={20} color="#DC3545" />,
        };
      case 'warning':
        return {
          backgroundColor: '#FFF3CD',
          borderColor: '#FFEAA7',
          textColor: '#856404',
          icon: <AlertTriangle size={20} color="#FFC107" />,
        };
      case 'info':
        return {
          backgroundColor: '#D1ECF1',
          borderColor: '#BEE5EB',
          textColor: '#0C5460',
          icon: <Info size={20} color="#17A2B8" />,
        };
      default:
        return {
          backgroundColor: Colors.card,
          borderColor: Colors.border,
          textColor: Colors.text.primary,
          icon: <Info size={20} color={Colors.primary} />,
        };
    }
  };

  const config = getToastConfig();

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: config.backgroundColor,
            borderColor: config.borderColor,
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            {config.icon}
          </View>
          
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: config.textColor }]}>
              {title}
            </Text>
            {message && (
              <Text style={[styles.message, { color: config.textColor }]}>
                {message}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <X size={16} color={config.textColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // Below status bar
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
});