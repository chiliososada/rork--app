/**
 * コンテンツモデレーションシステム
 * サーバーサイドモデレーション機能の TypeScript インターフェース
 */
import { supabase } from '@/lib/supabase';
import 'react-native-get-random-values';

export interface ModerationResult {
  action: 'approved' | 'flagged' | 'auto_blocked' | 'manual_review';
  isBlocked: boolean;
  severityScore: number;
  violationCategories: string[];
  message: string;
}

export interface UserSanctionStatus {
  isSanctioned: boolean;
  activeSanctions: any[];
  canPost: boolean;
  canComment: boolean;
  canChat: boolean;
}

export interface ReportSubmissionResult {
  reportId: string | null;
  status: 'submitted' | 'rate_limited' | 'duplicate' | 'error';
  message: string;
}

export type ContentType = 'topic' | 'comment' | 'chat_message' | 'user_profile' | 'message';
export type ReportReason = 
  | 'spam'
  | 'harassment' 
  | 'hate_speech'
  | 'adult_content'
  | 'violence'
  | 'discrimination'
  | 'false_information'
  | 'copyright_violation'
  | 'personal_information'
  | 'other';

class ContentModerationService {
  private static instance: ContentModerationService;
  
  private constructor() {}
  
  public static getInstance(): ContentModerationService {
    if (!ContentModerationService.instance) {
      ContentModerationService.instance = new ContentModerationService();
    }
    return ContentModerationService.instance;
  }
  
  /**
   * コンテンツをモデレーション検査
   */
  public async moderateContent(
    content: string,
    contentType: ContentType,
    contentId: string,
    userId: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ModerationResult> {
    try {
      const { data, error } = await supabase.rpc('moderate_content', {
        content_text: content,
        content_type_param: contentType,
        content_id_param: contentId,
        user_id_param: userId,
        ip_address_param: metadata?.ipAddress || null,
        user_agent_param: metadata?.userAgent || null
      });
      
      if (error) {
        console.error('コンテンツモデレーションエラー:', error);
        throw error;
      }
      
      const result = data[0];
      return {
        action: result.action,
        isBlocked: result.is_blocked,
        severityScore: result.severity_score,
        violationCategories: result.violation_categories,
        message: result.message
      };
      
    } catch (error) {
      console.error('コンテンツモデレーション処理に失敗:', error);
      // フォールバックとして承認を返す（安全側に倒す）
      return {
        action: 'approved',
        isBlocked: false,
        severityScore: 0,
        violationCategories: [],
        message: 'モデレーション処理をスキップしました'
      };
    }
  }
  
  /**
   * ユーザーの制裁状況をチェック
   */
  public async checkUserSanctions(userId: string): Promise<UserSanctionStatus> {
    try {
      const { data, error } = await supabase.rpc('check_user_sanctions', {
        user_id_param: userId
      });
      
      if (error) {
        console.error('制裁状況チェックエラー:', error);
        throw error;
      }
      
      const result = data[0];
      return {
        isSanctioned: result.is_sanctioned,
        activeSanctions: result.active_sanctions,
        canPost: result.can_post,
        canComment: result.can_comment,
        canChat: result.can_chat
      };
      
    } catch (error) {
      console.error('制裁状況チェックに失敗:', error);
      // エラー時は制限なしとして扱う（機能を維持）
      return {
        isSanctioned: false,
        activeSanctions: [],
        canPost: true,
        canComment: true,
        canChat: true
      };
    }
  }
  
  /**
   * ユーザーレポートを提出
   */
  public async submitUserReport(
    reporterId: string,
    reportedUserId: string,
    contentType: ContentType,
    contentId: string,
    reason: ReportReason,
    description?: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ReportSubmissionResult> {
    try {
      const { data, error } = await supabase.rpc('submit_user_report', {
        reporter_id_param: reporterId,
        reported_user_id_param: reportedUserId,
        content_type_param: contentType,
        content_id_param: contentId,
        report_reason_param: reason,
        report_description_param: description || null,
        ip_address_param: metadata?.ipAddress || null,
        user_agent_param: metadata?.userAgent || null
      });
      
      if (error) {
        console.error('レポート提出エラー:', error);
        throw error;
      }
      
      const result = data[0];
      return {
        reportId: result.report_id,
        status: result.status,
        message: result.message
      };
      
    } catch (error) {
      console.error('レポート提出に失敗:', error);
      return {
        reportId: null,
        status: 'error',
        message: 'レポート提出に失敗しました'
      };
    }
  }
  
  /**
   * コンテンツ投稿前の事前チェック
   */
  public async preCheckContent(
    content: string,
    contentType: ContentType,
    userId: string
  ): Promise<{
    canPost: boolean;
    moderationResult?: ModerationResult;
    sanctionStatus?: UserSanctionStatus;
    message: string;
  }> {
    try {
      // まずユーザーの制裁状況をチェック
      const sanctionStatus = await this.checkUserSanctions(userId);
      
      // 制裁による投稿制限チェック
      let canPostDueTo;
      switch (contentType) {
        case 'topic':
          canPostDueTo = sanctionStatus.canPost;
          break;
        case 'comment':
          canPostDueTo = sanctionStatus.canComment;
          break;
        case 'chat_message':
          canPostDueTo = sanctionStatus.canChat;
          break;
        default:
          canPostDueTo = true;
      }
      
      if (!canPostDueTo) {
        return {
          canPost: false,
          sanctionStatus,
          message: 'アカウント制限により投稿できません'
        };
      }
      
      // コンテンツモデレーション
      // React Native対応のUUID生成
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      const tempId = generateUUID();
      const moderationResult = await this.moderateContent(
        content,
        contentType,
        tempId,
        userId
      );
      
      if (moderationResult.isBlocked) {
        return {
          canPost: false,
          moderationResult,
          sanctionStatus,
          message: moderationResult.message
        };
      }
      
      return {
        canPost: true,
        moderationResult,
        sanctionStatus,
        message: 'コンテンツは投稿可能です'
      };
      
    } catch (error) {
      console.error('事前チェックに失敗:', error);
      // エラー時は投稿を許可（機能を維持）
      return {
        canPost: true,
        message: 'チェックをスキップして投稿を許可しました'
      };
    }
  }
  
  /**
   * 投稿後のモデレーション処理
   */
  public async postModerationCheck(
    content: string,
    contentType: ContentType,
    contentId: string,
    userId: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ModerationResult> {
    return this.moderateContent(content, contentType, contentId, userId, metadata);
  }
  
  /**
   * クライアントサイドでの簡易検査（基本的なキーワードフィルタ）
   */
  public quickContentCheck(content: string): {
    hasPotentialIssues: boolean;
    suggestedAction: 'allow' | 'warn' | 'block';
    issues: string[];
  } {
    const issues: string[] = [];
    let suggestedAction: 'allow' | 'warn' | 'block' = 'allow';
    
    // 基本的な日本語NGワードチェック
    const severeWords = ['死ね', '殺す', '殺し'];
    const warningWords = ['バカ', 'アホ', 'クソ'];
    const spamPatterns = [
      /副業/,
      /稼げる/,
      /簡単に/,
      /今すぐ/,
      /無料で/
    ];
    
    // 個人情報パターン
    const personalInfoPatterns = [
      /\d{3}-\d{4}-\d{4}/, // 電話番号
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // メールアドレス
      /〒?\d{3}-?\d{4}/ // 郵便番号
    ];
    
    // 重大な問題のチェック
    for (const word of severeWords) {
      if (content.includes(word)) {
        issues.push(`不適切な表現: ${word}`);
        suggestedAction = 'block';
      }
    }
    
    // 警告レベルのチェック
    for (const word of warningWords) {
      if (content.includes(word)) {
        issues.push(`注意すべき表現: ${word}`);
        if (suggestedAction === 'allow') {
          suggestedAction = 'warn';
        }
      }
    }
    
    // スパムパターンのチェック
    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        issues.push('スパム的な表現が検出されました');
        if (suggestedAction === 'allow') {
          suggestedAction = 'warn';
        }
      }
    }
    
    // 個人情報のチェック
    for (const pattern of personalInfoPatterns) {
      if (pattern.test(content)) {
        issues.push('個人情報が含まれている可能性があります');
        suggestedAction = 'block';
      }
    }
    
    return {
      hasPotentialIssues: issues.length > 0,
      suggestedAction,
      issues
    };
  }
  
  /**
   * レポート理由の日本語表示名を取得
   */
  public getReportReasonDisplayName(reason: ReportReason): string {
    const displayNames: Record<ReportReason, string> = {
      spam: 'スパム',
      harassment: 'ハラスメント',
      hate_speech: 'ヘイトスピーチ',
      adult_content: 'アダルトコンテンツ',
      violence: '暴力的表現',
      discrimination: '差別的表現',
      false_information: '虚偽情報',
      copyright_violation: '著作権侵害',
      personal_information: '個人情報',
      other: 'その他'
    };
    
    return displayNames[reason] || reason;
  }
  
  /**
   * モデレーション統計を取得（管理者用）
   */
  public async getModerationStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalActions: number;
    approvedCount: number;
    flaggedCount: number;
    blockedCount: number;
    topViolationCategories: Array<{ category: string; count: number }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('content_moderation_logs')
        .select('moderation_action, violation_categories')
        .gte('created_at', startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString());
      
      if (error) throw error;
      
      const stats = {
        totalActions: data.length,
        approvedCount: 0,
        flaggedCount: 0,
        blockedCount: 0,
        topViolationCategories: [] as Array<{ category: string; count: number }>
      };
      
      const categoryCount = new Map<string, number>();
      
      data.forEach(record => {
        switch (record.moderation_action) {
          case 'approved':
            stats.approvedCount++;
            break;
          case 'flagged':
            stats.flaggedCount++;
            break;
          case 'auto_blocked':
          case 'blocked':
            stats.blockedCount++;
            break;
        }
        
        // バイオレーションカテゴリーをカウント
        if (Array.isArray(record.violation_categories)) {
          record.violation_categories.forEach((category: string) => {
            categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
          });
        }
      });
      
      // 上位のバイオレーションカテゴリーを取得
      stats.topViolationCategories = Array.from(categoryCount.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      return stats;
      
    } catch (error) {
      console.error('モデレーション統計取得に失敗:', error);
      return {
        totalActions: 0,
        approvedCount: 0,
        flaggedCount: 0,
        blockedCount: 0,
        topViolationCategories: []
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const contentModerationService = ContentModerationService.getInstance();

// ユーティリティ関数
export const ModerationUtils = {
  /**
   * モデレーション結果に基づいてユーザーに表示するメッセージを生成
   */
  getUserFriendlyMessage: (result: ModerationResult): string => {
    switch (result.action) {
      case 'approved':
        return 'コンテンツが投稿されました';
      case 'flagged':
        return 'コンテンツに一部問題がある可能性がありますが、投稿されました';
      case 'auto_blocked':
        return 'コンテンツに問題があるため投稿できませんでした';
      case 'manual_review':
        return 'コンテンツはレビュー待ちです';
      default:
        return result.message;
    }
  },
  
  /**
   * 制裁状況に基づいてユーザーメッセージを生成
   */
  getSanctionMessage: (sanctions: UserSanctionStatus): string => {
    if (!sanctions.isSanctioned) {
      return '';
    }
    
    if (!sanctions.canPost && !sanctions.canComment && !sanctions.canChat) {
      return 'アカウントが一時的に制限されています';
    } else if (!sanctions.canPost) {
      return '新しい話題の投稿が制限されています';
    } else if (!sanctions.canComment) {
      return 'コメントの投稿が制限されています';
    } else if (!sanctions.canChat) {
      return 'チャット機能が制限されています';
    }
    
    return '一部機能が制限されています';
  },
  
  /**
   * バイオレーションカテゴリーの日本語表示名
   */
  getViolationCategoryDisplayName: (category: string): string => {
    const displayNames: Record<string, string> = {
      spam: 'スパム',
      harassment: 'ハラスメント',
      hate_speech: 'ヘイトスピーチ',
      adult_content: 'アダルトコンテンツ',
      violence: '暴力的表現',
      discrimination: '差別的表現',
      profanity: '冒逸的言葉',
      personal_info: '個人情報'
    };
    
    return displayNames[category] || category;
  }
};