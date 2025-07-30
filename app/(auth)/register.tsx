import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { Square, CheckSquare, Calendar, AlertTriangle } from 'lucide-react-native';
import AdultContentModal from '@/components/AdultContentModal';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, error, isAuthenticated, clearError } = useAuthStore();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [isVerifyingAge, setIsVerifyingAge] = useState(false);
  const [showAdultModal, setShowAdultModal] = useState(false);
  
  // If user is already authenticated, redirect to main app
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }
  
  const verifyAge = async () => {
    if (!birthDate) {
      Alert.alert('エラー', '生年月日を入力してください。');
      return;
    }

    // Basic date format validation (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birthDate)) {
      Alert.alert('エラー', '正しい形式で生年月日を入力してください（YYYY-MM-DD）。');
      return;
    }

    const birth = new Date(birthDate);
    const today = new Date();
    
    // Check if date is valid
    if (isNaN(birth.getTime()) || birth > today) {
      Alert.alert('エラー', '有効な生年月日を入力してください。');
      return;
    }

    setIsVerifyingAge(true);
    
    try {
      // For pre-registration verification, we'll use a simplified check
      // The actual RPC verification will happen after account creation
      const age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;

      if (calculatedAge < 18) {
        setIsVerifyingAge(false);
        Alert.alert(
          '年齢制限',
          'このサービスは18歳以上の方のみご利用いただけます。',
          [{ text: 'OK' }]
        );
        return;
      }

      // Show adult content confirmation modal
      setIsVerifyingAge(false);
      setShowAdultModal(true);
    } catch (error) {
      console.error('Age verification error:', error);
      setIsVerifyingAge(false);
      Alert.alert('エラー', '年齢確認中にエラーが発生しました。もう一度お試しください。');
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('エラー', 'すべての項目を入力してください。');
      return;
    }

    if (!ageVerified) {
      Alert.alert('エラー', '年齢確認を完了してください。');
      return;
    }
    
    if (!termsAccepted) {
      Alert.alert('エラー', '利用規約とプライバシーポリシーに同意してください。');
      return;
    }

    try {
      // Register the user first
      await register(name, email, password);
      
      // After successful registration, update with birth date and age verification
      const { data: { user }, error: getUserError } = await supabase.auth.getUser();
      
      if (getUserError || !user) {
        console.error('Error getting user after registration:', getUserError);
        return;
      }

      // Update user with birth date and age verification
      const { data, error: verifyError } = await supabase
        .rpc('verify_user_age', {
          user_id_param: user.id,
          birth_date_param: birthDate,
          verification_method_param: 'self_declared',
          ip_address_param: null,
          user_agent_param: navigator.userAgent || null
        });

      if (verifyError) {
        console.error('Error verifying age:', verifyError);
        // Continue anyway since user is already registered
      } else {
        console.log('Age verification result:', data);
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
  };
  
  const handleLogin = () => {
    router.push('/login');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>アカウント作成</Text>
            <Text style={styles.subtitle}>地域の会話に参加しよう</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <Input
              label="ニックネーム"
              placeholder="ニックネームを入力"
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearError();
              }}
              autoCapitalize="words"
              autoComplete="name"
            />
            
            <Input
              label="メールアドレス"
              placeholder="メールアドレスを入力"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            
            <Input
              label="パスワード"
              placeholder="パスワードを作成"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearError();
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
            />

            {/* Age Verification Section */}
            <View style={styles.ageVerificationSection}>
              <Text style={styles.ageVerificationTitle}>年齢確認</Text>
              <Text style={styles.ageVerificationSubtitle}>
                このサービスは18歳以上の方のみご利用いただけます
              </Text>
              
              <View style={styles.birthDateContainer}>
                <Input
                  label="生年月日 *"
                  placeholder="YYYY-MM-DD (例: 1990-01-01)"
                  value={birthDate}
                  onChangeText={(text) => {
                    setBirthDate(text);
                    setAgeVerified(false); // Reset verification when date changes
                    clearError();
                  }}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  maxLength={10}
                  editable={!ageVerified}
                />
                
                <TouchableOpacity
                  style={[
                    styles.verifyAgeButton,
                    ageVerified && styles.verifyAgeButtonSuccess,
                    (!birthDate || isVerifyingAge) && styles.verifyAgeButtonDisabled
                  ]}
                  onPress={verifyAge}
                  disabled={!birthDate || isVerifyingAge || ageVerified}
                  activeOpacity={0.7}
                >
                  {isVerifyingAge ? (
                    <Text style={styles.verifyAgeButtonText}>確認中...</Text>
                  ) : ageVerified ? (
                    <>
                      <CheckSquare size={16} color="#FFFFFF" />
                      <Text style={[styles.verifyAgeButtonText, { marginLeft: 6 }]}>
                        確認済み
                      </Text>
                    </>
                  ) : (
                    <>
                      <Calendar size={16} color="#FFFFFF" />
                      <Text style={[styles.verifyAgeButtonText, { marginLeft: 6 }]}>
                        年齢確認
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {ageVerified && (
                <View style={styles.ageVerifiedBanner}>
                  <CheckSquare size={20} color="#34C759" />
                  <Text style={styles.ageVerifiedText}>年齢確認が完了しました</Text>
                </View>
              )}

              <View style={styles.ageVerificationNotice}>
                <AlertTriangle size={16} color="#FF9500" />
                <Text style={styles.ageVerificationNoticeText}>
                  虚偽の情報を入力することは利用規約違反となり、アカウントが停止される場合があります。
                </Text>
              </View>
            </View>
            
            <View style={styles.termsContainer}>
              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={() => setTermsAccepted(!termsAccepted)}
                activeOpacity={0.7}
              >
                {termsAccepted ? (
                  <CheckSquare size={20} color={Colors.primary} />
                ) : (
                  <Square size={20} color={Colors.text.secondary} />
                )}
              </TouchableOpacity>
              <View style={styles.termsTextContainer}>
                <Text style={styles.termsText}>
                  アカウントを作成することで、
                </Text>
                <View style={styles.termsLinks}>
                  <TouchableOpacity onPress={() => router.push('/legal/terms-of-service')}>
                    <Text style={styles.termsLink}>利用規約</Text>
                  </TouchableOpacity>
                  <Text style={styles.termsText}> と </Text>
                  <TouchableOpacity onPress={() => router.push('/legal/privacy-policy')}>
                    <Text style={styles.termsLink}>プライバシーポリシー</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.termsText}>
                  に同意したものとみなされます。
                </Text>
              </View>
            </View>
            
            <Button
              title="アカウント作成"
              onPress={handleRegister}
              isLoading={isLoading}
              style={styles.registerButton}
            />
            
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>すでにアカウントをお持ちですか？</Text>
              <TouchableOpacity onPress={handleLogin}>
                <Text style={styles.loginLink}>ログイン</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      <AdultContentModal
        visible={showAdultModal}
        onConfirm={() => {
          setShowAdultModal(false);
          setAgeVerified(true);
          Alert.alert(
            '年齢確認完了',
            '年齢確認が完了しました。アカウント作成を続行できます。',
            [{ text: 'OK' }]
          );
        }}
        onDecline={() => {
          setShowAdultModal(false);
          setAgeVerified(false);
          setBirthDate('');
          Alert.alert(
            '年齢制限',
            'このサービスは18歳以上の方のみご利用いただけます。',
            [{ text: 'OK' }]
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
  },
  termsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  termsLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  termsLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
    lineHeight: 18,
  },
  registerButton: {
    marginBottom: 24,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: Colors.text.secondary,
    fontSize: 14,
    marginRight: 4,
  },
  loginLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  ageVerificationSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ageVerificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  ageVerificationSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  birthDateContainer: {
    marginBottom: 16,
  },
  verifyAgeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  verifyAgeButtonSuccess: {
    backgroundColor: '#34C759',
  },
  verifyAgeButtonDisabled: {
    backgroundColor: Colors.text.secondary,
    opacity: 0.6,
  },
  verifyAgeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ageVerifiedBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ageVerifiedText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  ageVerificationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
  },
  ageVerificationNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
    marginLeft: 8,
  },
});