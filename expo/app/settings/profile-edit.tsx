import React, { useState, useEffect } from 'react';
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
import { User, Save, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import Input from '@/components/Input';
import AvatarPicker from '@/components/AvatarPicker';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, updateProfile, updateAvatar, isUpdatingProfile, isUpdatingAvatar } = useAuthStore();
  
  // フォームの状態
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [hasChanges, setHasChanges] = useState(false);
  
  // 初期値設定
  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '');
      setBio(user.bio || '');
      setGender(user.gender || '');
    }
  }, [user]);
  
  // 変更検知
  useEffect(() => {
    const originalNickname = user?.nickname || '';
    const originalBio = user?.bio || '';
    const originalGender = user?.gender || '';
    
    const changed = 
      nickname !== originalNickname ||
      bio !== originalBio ||
      gender !== originalGender;
    
    setHasChanges(changed);
  }, [nickname, bio, gender, user]);

  const handleSave = async () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    if (!nickname.trim()) {
      Alert.alert('エラー', 'ニックネームを入力してください。');
      return;
    }

    if (nickname.trim().length > 50) {
      Alert.alert('エラー', 'ニックネームは50文字以内で入力してください。');
      return;
    }

    if (bio.length > 500) {
      Alert.alert('エラー', '自己紹介は500文字以内で入力してください。');
      return;
    }

    try {
      await updateProfile({
        nickname: nickname.trim(),
        bio: bio.trim(),
        gender: gender || null
      });
      
      Alert.alert(
        '完了',
        'プロフィールを更新しました。',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      // エラーは useAuthStore で処理済み
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        '変更を破棄',
        '変更を保存せずに戻りますか？',
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

  const handleAvatarChange = async (newAvatarUrl: string) => {
    try {
      await updateAvatar(newAvatarUrl);
    } catch (error) {
      // エラーは useAuthStore で処理済み
    }
  };

  const genderOptions = [
    { value: '', label: '未設定' },
    { value: '男性', label: '男性' },
    { value: '女性', label: '女性' },
    { value: 'その他', label: 'その他' },
    { value: '回答しない', label: '回答しない' }
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'プロフィール編集',
          headerBackTitle: '戻る',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isUpdatingProfile || !hasChanges}
              style={[
                styles.headerButton,
                (!hasChanges || isUpdatingProfile) && styles.headerButtonDisabled
              ]}
            >
              <Save 
                size={20} 
                color={!hasChanges || isUpdatingProfile ? '#999' : Colors.primary} 
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
            {/* アバター編集セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>プロフィール画像</Text>
              <View style={styles.avatarContainer}>
                <AvatarPicker
                  currentAvatarUrl={user?.avatar}
                  userId={user?.id || ''}
                  onAvatarChange={handleAvatarChange}
                  size={120}
                  editable={true}
                />
                <Text style={styles.avatarHint}>
                  画像をタップして変更
                </Text>
              </View>
            </View>

            {/* 基本情報編集セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>基本情報</Text>
              
              <Input
                label="ニックネーム *"
                value={nickname}
                onChangeText={setNickname}
                placeholder="表示名を入力してください"
                maxLength={50}
                containerStyle={styles.inputContainer}
              />
              
              <Input
                label="自己紹介"
                value={bio}
                onChangeText={setBio}
                placeholder="自己紹介を入力してください（任意）"
                multiline
                numberOfLines={4}
                maxLength={500}
                containerStyle={styles.inputContainer}
                inputStyle={styles.bioInput}
              />
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>性別</Text>
                <View style={styles.genderContainer}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.genderOption,
                        gender === option.value && styles.genderOptionSelected
                      ]}
                      onPress={() => setGender(option.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        gender === option.value && styles.genderOptionTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* 文字数カウンター */}
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                ニックネーム: {nickname.length} / 50
              </Text>
              <Text style={styles.counterText}>
                自己紹介: {bio.length} / 500
              </Text>
            </View>

            {/* 注意事項 */}
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>プロフィール編集について</Text>
              <Text style={styles.noticeText}>
                • ニックネームは他のユーザーに表示される名前です{'\n'}
                • 自己紹介は任意項目です{'\n'}
                • 不適切な内容は運営により削除される場合があります{'\n'}
                • プロフィール画像は適切なものをご利用ください
              </Text>
            </View>

            {/* 保存ボタン */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!hasChanges || isUpdatingProfile) && styles.saveButtonDisabled
              ]}
              onPress={handleSave}
              disabled={!hasChanges || isUpdatingProfile}
              activeOpacity={0.7}
            >
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                {isUpdatingProfile ? '更新中...' : '変更を保存'}
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
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatarHint: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  genderOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderOptionText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  genderOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  counterContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  counterText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1565C0',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#999999',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});