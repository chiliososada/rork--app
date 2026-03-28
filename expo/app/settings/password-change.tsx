import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Lock, Eye, EyeOff, Save, X, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import Input from '@/components/Input';
import { supabase } from '@/lib/supabase';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export default function PasswordChangeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // フォームの状態
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // パスワード表示状態
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // パスワード強度を計算
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };

    const score = Object.values(requirements).filter(Boolean).length;
    
    let label = '弱い';
    let color = '#FF3B30';
    
    if (score >= 4) {
      label = '強い';
      color = '#34C759';
    } else if (score >= 3) {
      label = '普通';
      color = '#FF9500';
    }

    return { score, label, color, requirements };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  // バリデーション
  const validateForm = (): string | null => {
    if (!currentPassword.trim()) {
      return '現在のパスワードを入力してください。';
    }

    if (!newPassword.trim()) {
      return '新しいパスワードを入力してください。';
    }

    if (newPassword.length < 8) {
      return 'パスワードは8文字以上で入力してください。';
    }

    if (newPassword === currentPassword) {
      return '新しいパスワードは現在のパスワードと異なるものを入力してください。';
    }

    if (!confirmPassword.trim()) {
      return 'パスワードの確認を入力してください。';
    }

    if (newPassword !== confirmPassword) {
      return '新しいパスワードと確認用パスワードが一致しません。';
    }

    if (passwordStrength.score < 3) {
      return 'より強いパスワードを設定してください。';
    }

    return null;
  };

  const handlePasswordChange = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('入力エラー', validationError);
      return;
    }

    setIsUpdating(true);

    try {
      // まず現在のパスワードで認証確認
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('現在のパスワードが正しくありません。');
      }

      // パスワードを更新
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      Alert.alert(
        'パスワード変更完了',
        'パスワードが正常に変更されました。セキュリティのため、再度ログインしてください。',
        [
          {
            text: 'OK',
            onPress: () => {
              // パスワード変更後は安全のため再ログインを促す
              router.back();
            }
          }
        ]
      );

    } catch (error: any) {
      let errorMessage = 'パスワードの変更に失敗しました。';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = '現在のパスワードが正しくありません。';
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = 'パスワードは6文字以上で設定してください。';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('エラー', errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    if (currentPassword || newPassword || confirmPassword) {
      Alert.alert(
        '変更を破棄',
        '入力内容を破棄して戻りますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: '破棄',
            style: 'destructive',
            onPress: () => router.back()
          }
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'パスワード変更',
          headerBackTitle: '戻る',
          headerRight: () => (
            <TouchableOpacity
              onPress={handlePasswordChange}
              disabled={isUpdating}
              style={[
                styles.headerButton,
                isUpdating && styles.headerButtonDisabled
              ]}
            >
              <Save 
                size={20} 
                color={isUpdating ? '#999' : Colors.primary} 
              />
            </TouchableOpacity>
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
            >
              <X size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* セキュリティ注意事項 */}
            <View style={styles.securityNotice}>
              <Shield size={24} color="#1976D2" />
              <View style={styles.securityNoticeContent}>
                <Text style={styles.securityNoticeTitle}>セキュリティについて</Text>
                <Text style={styles.securityNoticeText}>
                  パスワード変更後、セキュリティのため再ログインが必要になります。
                </Text>
              </View>
            </View>

            {/* パスワード入力セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>パスワード変更</Text>
              
              {/* 現在のパスワード */}
              <View style={styles.inputContainer}>
                <Input
                  label="現在のパスワード *"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="現在のパスワードを入力"
                  secureTextEntry={!showCurrentPassword}
                  containerStyle={styles.passwordInputContainer}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff size={20} color={Colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={Colors.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* 新しいパスワード */}
              <View style={styles.inputContainer}>
                <Input
                  label="新しいパスワード *"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="新しいパスワードを入力"
                  secureTextEntry={!showNewPassword}
                  containerStyle={styles.passwordInputContainer}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff size={20} color={Colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={Colors.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* パスワード強度表示 */}
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthHeader}>
                    <Text style={styles.strengthLabel}>パスワード強度:</Text>
                    <Text style={[styles.strengthValue, { color: passwordStrength.color }]}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBarSegment,
                          {
                            backgroundColor: level <= passwordStrength.score
                              ? passwordStrength.color
                              : '#E0E0E0'
                          }
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.requirementsList}>
                    <Text style={[
                      styles.requirement,
                      passwordStrength.requirements.length && styles.requirementMet
                    ]}>
                      ✓ 8文字以上
                    </Text>
                    <Text style={[
                      styles.requirement,
                      passwordStrength.requirements.uppercase && styles.requirementMet
                    ]}>
                      ✓ 大文字を含む
                    </Text>
                    <Text style={[
                      styles.requirement,
                      passwordStrength.requirements.number && styles.requirementMet
                    ]}>
                      ✓ 数字を含む
                    </Text>
                  </View>
                </View>
              )}

              {/* パスワード確認 */}
              <View style={styles.inputContainer}>
                <Input
                  label="新しいパスワード（確認） *"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="新しいパスワードを再入力"
                  secureTextEntry={!showConfirmPassword}
                  containerStyle={styles.passwordInputContainer}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={Colors.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* パスワード一致確認 */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchIndicator}>
                  <Text style={[
                    styles.matchText,
                    newPassword === confirmPassword 
                      ? styles.matchTextSuccess 
                      : styles.matchTextError
                  ]}>
                    {newPassword === confirmPassword 
                      ? '✓ パスワードが一致しています' 
                      : '✗ パスワードが一致しません'
                    }
                  </Text>
                </View>
              )}
            </View>

            {/* 注意事項 */}
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>パスワード変更について</Text>
              <Text style={styles.noticeText}>
                • 安全なパスワードを設定してください{'\n'}
                • 他のサービスと同じパスワードは使用しないでください{'\n'}
                • 定期的にパスワードを変更することをお勧めします{'\n'}
                • パスワード変更後は再ログインが必要です
              </Text>
            </View>

            {/* 変更ボタン */}
            <TouchableOpacity
              style={[
                styles.changeButton,
                (isUpdating || validateForm()) && styles.changeButtonDisabled
              ]}
              onPress={handlePasswordChange}
              disabled={isUpdating || !!validateForm()}
              activeOpacity={0.7}
            >
              <Lock size={20} color="#FFFFFF" />
              <Text style={styles.changeButtonText}>
                {isUpdating ? '変更中...' : 'パスワードを変更'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  securityNotice: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  securityNoticeContent: {
    flex: 1,
    marginLeft: 12,
  },
  securityNoticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  securityNoticeText: {
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 18,
  },
  section: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInputContainer: {
    marginBottom: 0,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 42,
    padding: 4,
  },
  strengthContainer: {
    marginBottom: 16,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  strengthValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  strengthBarSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  requirementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  requirement: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  requirementMet: {
    color: '#34C759',
  },
  matchIndicator: {
    marginBottom: 8,
  },
  matchText: {
    fontSize: 12,
    textAlign: 'center',
  },
  matchTextSuccess: {
    color: '#34C759',
  },
  matchTextError: {
    color: '#FF3B30',
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#E65100',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    marginTop: 8,
  },
  changeButtonDisabled: {
    backgroundColor: '#999999',
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});