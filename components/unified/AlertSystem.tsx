import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

// Types
type AlertType = 'success' | 'warning' | 'error' | 'info';
type ToastType = 'success' | 'warning' | 'error' | 'info';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
}

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom';
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showToast: (options: ToastOptions) => void;
  hideAlert: () => void;
  hideToast: () => void;
}

// Context
const AlertContext = createContext<AlertContextType | null>(null);

// Hook to use alert system
export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

// Alert Provider Component
export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastOptions, setToastOptions] = useState<ToastOptions | null>(null);
  const [toastAnimation] = useState(new Animated.Value(0));

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertOptions(options);
    setAlertVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setAlertVisible(false);
    setTimeout(() => setAlertOptions(null), 300);
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    setToastOptions(options);
    setToastVisible(true);
    
    // Animate in
    Animated.spring(toastAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    // Auto hide after duration
    const duration = options.duration || 3000;
    setTimeout(() => {
      hideToast();
    }, duration);
  }, [toastAnimation]);

  const hideToast = useCallback(() => {
    Animated.spring(toastAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setToastVisible(false);
      setToastOptions(null);
    });
  }, [toastAnimation]);

  const getAlertIcon = (type?: AlertType) => {
    const iconProps = { size: 24 };
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} color="#34C759" />;
      case 'warning':
        return <AlertTriangle {...iconProps} color="#FF9500" />;
      case 'error':
        return <XCircle {...iconProps} color="#FF3B30" />;
      default:
        return <Info {...iconProps} color="#007AFF" />;
    }
  };

  const getToastIcon = (type?: ToastType) => {
    const iconProps = { size: 20 };
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} color="#FFFFFF" />;
      case 'warning':
        return <AlertTriangle {...iconProps} color="#FFFFFF" />;
      case 'error':
        return <XCircle {...iconProps} color="#FFFFFF" />;
      default:
        return <Info {...iconProps} color="#FFFFFF" />;
    }
  };

  const getToastBackgroundColor = (type?: ToastType) => {
    switch (type) {
      case 'success':
        return '#34C759';
      case 'warning':
        return '#FF9500';
      case 'error':
        return '#FF3B30';
      default:
        return '#007AFF';
    }
  };

  const contextValue: AlertContextType = {
    showAlert,
    showToast,
    hideAlert,
    hideToast,
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}

      {/* Alert Modal */}
      <Modal
        visible={alertVisible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {alertOptions?.type && (
              <View style={styles.alertIconContainer}>
                {getAlertIcon(alertOptions.type)}
              </View>
            )}
            
            <Text style={styles.alertTitle}>{alertOptions?.title}</Text>
            
            {alertOptions?.message && (
              <Text style={styles.alertMessage}>{alertOptions.message}</Text>
            )}
            
            <View style={styles.alertButtonContainer}>
              {alertOptions?.buttons?.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.alertButton,
                    button.style === 'cancel' && styles.alertButtonCancel,
                    button.style === 'destructive' && styles.alertButtonDestructive,
                    index === 0 && alertOptions.buttons!.length > 1 && styles.alertButtonFirst,
                  ]}
                  onPress={() => {
                    button.onPress?.();
                    hideAlert();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.alertButtonText,
                      button.style === 'cancel' && styles.alertButtonTextCancel,
                      button.style === 'destructive' && styles.alertButtonTextDestructive,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              )) || (
                <TouchableOpacity
                  style={styles.alertButton}
                  onPress={hideAlert}
                  activeOpacity={0.7}
                >
                  <Text style={styles.alertButtonText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toastVisible && toastOptions && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              backgroundColor: getToastBackgroundColor(toastOptions.type),
              transform: [
                {
                  translateY: toastAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: toastOptions.position === 'bottom' ? [100, 0] : [-100, 0],
                  }),
                },
                {
                  scale: toastAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
              opacity: toastAnimation,
            },
            toastOptions.position === 'bottom' ? styles.toastBottom : styles.toastTop,
          ]}
        >
          {getToastIcon(toastOptions.type)}
          <Text style={styles.toastText}>{toastOptions.message}</Text>
          <TouchableOpacity onPress={hideToast} style={styles.toastCloseButton}>
            <X size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </AlertContext.Provider>
  );
};

// Utility functions for common use cases
export const useBlockingAlerts = () => {
  const { showAlert, showToast } = useAlert();

  const confirmBlock = (userName: string, onConfirm: () => void) => {
    showAlert({
      title: 'ユーザーをブロック',
      message: `${userName}さんをブロックしますか？\n\nブロックすると：\n• この人の投稿やコメントが表示されなくなります\n• この人があなたをフォローできなくなります\n• お互いのチャット履歴が非表示になります`,
      type: 'warning',
      buttons: [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ブロックする', style: 'destructive', onPress: onConfirm },
      ],
    });
  };

  const confirmUnblock = (userName: string, onConfirm: () => void) => {
    showAlert({
      title: 'ブロック解除',
      message: `${userName}さんのブロックを解除しますか？\n\nブロックを解除すると：\n• この人の投稿やコメントが再び表示されます\n• この人があなたをフォローできるようになります\n• チャットでメッセージのやり取りができるようになります`,
      type: 'info',
      buttons: [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ブロック解除', onPress: onConfirm },
      ],
    });
  };

  const showBlockSuccess = (userName: string) => {
    showToast({
      message: `${userName}さんをブロックしました`,
      type: 'success',
    });
  };

  const showUnblockSuccess = (userName: string) => {
    showToast({
      message: `${userName}さんのブロックを解除しました`,
      type: 'success',
    });
  };

  return {
    confirmBlock,
    confirmUnblock,
    showBlockSuccess,
    showUnblockSuccess,
  };
};

export const useReportingAlerts = () => {
  const { showAlert, showToast } = useAlert();

  const showReportSuccess = () => {
    showToast({
      message: '通報を受け付けました',
      type: 'success',
    });
  };

  const showReportError = (message: string) => {
    showToast({
      message: message || '通報の送信に失敗しました',
      type: 'error',
    });
  };

  const confirmReport = (contentType: string, onConfirm: () => void) => {
    showAlert({
      title: '通報確認',
      message: `この${contentType}を通報しますか？\n\n虚偽の通報は利用規約違反となる場合があります。`,
      type: 'warning',
      buttons: [
        { text: 'キャンセル', style: 'cancel' },
        { text: '通報する', style: 'destructive', onPress: onConfirm },
      ],
    });
  };

  return {
    showReportSuccess,
    showReportError,
    confirmReport,
  };
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Alert styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    minWidth: width * 0.8,
    maxWidth: width * 0.9,
    alignItems: 'center',
  },
  alertIconContainer: {
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  alertButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  alertButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  alertButtonFirst: {
    marginRight: 8,
  },
  alertButtonCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertButtonDestructive: {
    backgroundColor: '#FF3B30',
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alertButtonTextCancel: {
    color: Colors.text.secondary,
  },
  alertButtonTextDestructive: {
    color: '#FFFFFF',
  },

  // Toast styles
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastTop: {
    top: 60,
  },
  toastBottom: {
    bottom: 100,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  toastCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
});