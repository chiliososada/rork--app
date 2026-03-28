import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Flag, AlertTriangle, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useReporting } from '@/store/reporting-store';
import { useAuthStore } from '@/store/auth-store';

interface UserReport {
  report_id: string;
  reported_user_name: string;
  content_type: string;
  category_name: string;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    userReports, 
    loadUserReports, 
    refreshUserReports, 
    isLoading,
    getReportStats 
  } = useReporting();

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadUserReports(user.id);
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      await refreshUserReports(user.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const iconProps = { size: 16 };
    
    switch (status) {
      case 'pending':
        return <Clock {...iconProps} color="#FF9500" />;
      case 'reviewing':
        return <AlertTriangle {...iconProps} color="#5856D6" />;
      case 'resolved':
        return <CheckCircle {...iconProps} color="#34C759" />;
      case 'dismissed':
        return <XCircle {...iconProps} color="#8E8E93" />;
      case 'escalated':
        return <AlertTriangle {...iconProps} color="#FF3B30" />;
      default:
        return <Clock {...iconProps} color="#8E8E93" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '処理待ち';
      case 'reviewing':
        return '確認中';
      case 'resolved':
        return '解決済み';
      case 'dismissed':
        return '却下';
      case 'escalated':
        return 'エスカレート';
      default:
        return '不明';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'reviewing':
        return '#5856D6';
      case 'resolved':
        return '#34C759';
      case 'dismissed':
        return '#8E8E93';
      case 'escalated':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getContentTypeText = (contentType: string) => {
    switch (contentType) {
      case 'topic':
        return '投稿';
      case 'comment':
        return 'コメント';
      case 'chat_message':
        return 'チャット';
      case 'private_message':
        return 'DM';
      case 'user':
        return 'ユーザー';
      default:
        return contentType;
    }
  };

  const formatReportDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return '昨日';
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}週間前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const handleReportPress = (report: UserReport) => {
    Alert.alert(
      '通報詳細',
      `通報対象: ${report.reported_user_name}さんの${getContentTypeText(report.content_type)}\n通報理由: ${report.category_name}\n詳細: ${report.reason}\n\nステータス: ${getStatusText(report.status)}${report.resolved_at ? `\n解決日: ${formatReportDate(report.resolved_at)}` : ''}`,
      [{ text: 'OK' }]
    );
  };

  const renderReport = (report: UserReport) => (
    <TouchableOpacity
      key={report.report_id}
      style={styles.reportItem}
      onPress={() => handleReportPress(report)}
      activeOpacity={0.7}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportTarget}>
          <Text style={styles.reportedUser}>{report.reported_user_name}</Text>
          <Text style={styles.contentType}>
            の{getContentTypeText(report.content_type)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '15' }]}>
          {getStatusIcon(report.status)}
          <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
            {getStatusText(report.status)}
          </Text>
        </View>
      </View>

      <View style={styles.reportDetails}>
        <Text style={styles.category}>{report.category_name}</Text>
        <Text style={styles.reason} numberOfLines={2}>
          {report.reason}
        </Text>
        <Text style={styles.reportDate}>
          {formatReportDate(report.created_at)}に通報
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Flag size={64} color={Colors.text.secondary} />
      </View>
      <Text style={styles.emptyTitle}>通報履歴はありません</Text>
      <Text style={styles.emptyDescription}>
        不適切なコンテンツやユーザーを通報すると、ここに履歴が表示されます。
        通報された内容は運営チームが確認し、適切な対応を行います。
      </Text>
    </View>
  );

  const stats = getReportStats();

  return (
    <>
      <Stack.Screen
        options={{
          title: '通報履歴',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* 説明セクション */}
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Flag size={24} color={Colors.primary} />
              <Text style={styles.infoTitle}>通報システムについて</Text>
            </View>
            <Text style={styles.infoDescription}>
              不適切なコンテンツやユーザーを通報することで、コミュニティの安全性を保つことができます。
              通報された内容は運営チームが確認し、必要に応じて適切な措置を講じます。
            </Text>
          </View>

          {/* 統計情報 */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>通報統計</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Flag size={20} color={Colors.text.secondary} />
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>総通報数</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Clock size={20} color="#FF9500" />
                <Text style={styles.statNumber}>{stats.pending}</Text>
                <Text style={styles.statLabel}>処理待ち</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <CheckCircle size={20} color="#34C759" />
                <Text style={styles.statNumber}>{stats.resolved}</Text>
                <Text style={styles.statLabel}>解決済み</Text>
              </View>
            </View>
          </View>

          {/* 最近の通報 */}
          {stats.recentReports.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>最近の通報</Text>
              <View style={styles.recentList}>
                {stats.recentReports.map(renderReport)}
              </View>
            </View>
          )}

          {/* 通報履歴リスト */}
          <View style={styles.reportsList}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>読み込み中...</Text>
              </View>
            ) : userReports.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={styles.reportsContainer}>
                <Text style={styles.sectionTitle}>
                  全ての通報履歴 ({userReports.length}件)
                </Text>
                {userReports.map(renderReport)}
              </View>
            )}
          </View>

          {/* 注意事項 */}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>通報に関する注意事項</Text>
            <Text style={styles.noticeText}>
              • 虚偽の通報や悪用は利用規約違反となります{'\n'}
              • 通報内容は運営チームが慎重に審査します{'\n'}
              • 処理完了まで数日かかる場合があります{'\n'}
              • 緊急を要する場合は直接お問い合わせください
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  infoSection: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  statsSection: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  recentSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentList: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportsList: {
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  reportsContainer: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportedUser: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  contentType: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  reportDetails: {
    marginTop: 4,
  },
  category: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginBottom: 4,
  },
  reason: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 18,
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6C5300',
  },
});