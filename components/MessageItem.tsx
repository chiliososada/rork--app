import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Message } from '@/types';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { Quote, Copy, Flag } from 'lucide-react-native';
import { formatMessageTime } from '@/lib/utils/timeUtils';
import ReportModal from '@/components/ReportModal';

interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const { user } = useAuthStore();
  const { setQuotedMessage } = useChatStore();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const isCurrentUser = user?.id === message.author.id;
  
  // コピー機能
  const handleCopyMessage = async () => {
    try {
      await Clipboard.setStringAsync(message.text);
      setShowContextMenu(false);
      Alert.alert('コピーしました', 'メッセージがクリップボードにコピーされました');
    } catch (error) {
      console.error('Copy failed:', error);
      Alert.alert('エラー', 'コピーに失敗しました');
    }
  };

  // 通報機能
  const handleReportPress = () => {
    setShowContextMenu(false);
    setShowReportModal(true);
  };
  
  // URLを検出する関数
  const detectUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };
  
  // メッセージ内のURLを検出
  const urls = detectUrls(message.text);
  
  // URLをリンクに置換したテキストを生成
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <Text key={index} style={styles.linkText}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };
  
  
  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : {}
    ]}>
      {!isCurrentUser && (
        <Image source={{ uri: message.author.avatar }} style={styles.avatar} />
      )}
      
      <TouchableOpacity 
        style={[
          styles.bubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}
        onLongPress={() => setShowContextMenu(true)}
        activeOpacity={0.8}
      >
        {!isCurrentUser && (
          <Text style={styles.authorName}>{message.author.name}</Text>
        )}
        
        <Text style={[
          styles.text,
          isCurrentUser ? styles.currentUserText : {}
        ]}>
          {renderTextWithLinks(message.text)}
        </Text>
        
        {/* URLプレビュー */}
        {urls.length > 0 && (
          <View style={styles.urlPreviewContainer}>
            {urls.slice(0, 2).map((url, index) => (
              <View key={index} style={styles.urlPreview}>
                <Text style={styles.urlPreviewText} numberOfLines={1}>
                  🔗 {url}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        
        <Text style={[
          styles.time,
          isCurrentUser ? styles.currentUserTime : {}
        ]}>
          {formatMessageTime(message.createdAt)}
        </Text>
      </TouchableOpacity>
      
      {/* コンテキストメニュー */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowContextMenu(false)}
        >
          <View style={styles.contextMenu}>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleCopyMessage}
            >
              <Copy size={18} color={Colors.text.primary} />
              <Text style={styles.contextMenuText}>コピー</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                setQuotedMessage(message);
                setShowContextMenu(false);
              }}
            >
              <Quote size={18} color={Colors.text.primary} />
              <Text style={styles.contextMenuText}>引用返信</Text>
            </TouchableOpacity>
            
            {/* 他のユーザーのメッセージにのみ通報オプションを表示 */}
            {!isCurrentUser && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={handleReportPress}
              >
                <Flag size={18} color="#FF9500" />
                <Text style={[styles.contextMenuText, styles.reportText]}>メッセージを通報</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={message.author.id}
        reportedUserName={message.author.name}
        contentType="chat_message"
        contentId={message.id}
        contentPreview={message.text.substring(0, 100)}
      />
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  currentUserContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2.5,
    elevation: 2,
  },
  currentUserBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 4,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  currentUserText: {
    color: Colors.text.light,
  },
  time: {
    fontSize: 10,
    color: '#999999',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  urlPreviewContainer: {
    marginTop: 8,
  },
  urlPreview: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    padding: 8,
    marginTop: 4,
    borderRadius: 4,
  },
  urlPreviewText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  contextMenu: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 8,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  contextMenuText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  reportText: {
    color: '#FF9500',
    fontWeight: '500',
  },
});