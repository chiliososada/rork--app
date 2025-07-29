import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// Types
interface ReportCategory {
  id: string;
  category_key: string;
  display_name_ja: string;
  display_name_en: string;
  description_ja: string | null;
  description_en: string | null;
  requires_details: boolean;
  sort_order: number;
}

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

interface ReportSubmissionResult {
  report_id: string | null;
  success: boolean;
  message: string;
}

interface ContentReportStatus {
  is_reported: boolean;
  report_status: string | null;
  report_date: string | null;
}

interface ReportingStore {
  // State
  reportCategories: ReportCategory[];
  userReports: UserReport[];
  reportedContent: Map<string, ContentReportStatus>; // contentType:contentId -> status
  isLoading: boolean;
  isSubmitting: boolean;
  lastUpdated: number;
  
  // Actions
  loadReportCategories: () => Promise<void>;
  loadUserReports: (userId: string, limit?: number, offset?: number) => Promise<void>;
  submitReport: (params: {
    reportedUserId: string;
    contentType: string;
    contentId?: string;
    categoryId: string;
    reason: string;
    description?: string;
  }) => Promise<ReportSubmissionResult>;
  checkContentReported: (contentType: string, contentId: string) => Promise<ContentReportStatus>;
  isContentReportedSync: (contentType: string, contentId: string) => boolean;
  clearReportCache: () => void;
  refreshUserReports: (userId: string) => Promise<void>;
}

export const useReportingStore = create<ReportingStore>((set, get) => ({
  // Initial state
  reportCategories: [],
  userReports: [],
  reportedContent: new Map(),
  isLoading: false,
  isSubmitting: false,
  lastUpdated: 0,

  // Load report categories
  loadReportCategories: async () => {
    try {
      set({ isLoading: true });
      
      const { data, error } = await supabase
        .from('report_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error loading report categories:', error);
        // Check if it's a network error
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          console.warn('Network error loading report categories, will retry later');
        }
        set({ isLoading: false });
        return;
      }

      set({
        reportCategories: data || [],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error('Error in loadReportCategories:', error);
      set({ isLoading: false });
    }
  },

  // Load user's report history
  loadUserReports: async (userId: string, limit = 20, offset = 0) => {
    try {
      set({ isLoading: true });
      
      const { data, error } = await supabase
        .rpc('get_user_reports', {
          user_id_param: userId,
          limit_count: limit,
          offset_count: offset
        });

      if (error) {
        console.error('Error loading user reports:', error);
        return;
      }

      set({
        userReports: offset === 0 ? (data || []) : [...get().userReports, ...(data || [])],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error('Error in loadUserReports:', error);
      set({ isLoading: false });
    }
  },

  // Submit a report
  submitReport: async (params) => {
    try {
      set({ isSubmitting: true });
      
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) {
        console.error('User not authenticated');
        return { report_id: null, success: false, message: 'ログインが必要です' };
      }

      const { data, error } = await supabase
        .rpc('submit_report', {
          reporter_id_param: currentUserId,
          reported_user_id_param: params.reportedUserId,
          content_type_param: params.contentType,
          category_id_param: params.categoryId,
          reason_param: params.reason,
          content_id_param: params.contentId || null,
          description_param: params.description || null
        });

      if (error) {
        console.error('Error submitting report:', error);
        return { report_id: null, success: false, message: '通報の送信に失敗しました' };
      }

      const result = data?.[0] as ReportSubmissionResult;
      
      if (result?.success) {
        // Update local cache
        if (params.contentId) {
          const { reportedContent } = get();
          const newReportedContent = new Map(reportedContent);
          const cacheKey = `${params.contentType}:${params.contentId}`;
          newReportedContent.set(cacheKey, {
            is_reported: true,
            report_status: 'pending',
            report_date: new Date().toISOString()
          });
          set({ reportedContent: newReportedContent });
        }

        // Refresh user reports
        await get().refreshUserReports(currentUserId);
      }

      set({ isSubmitting: false });
      return result;
    } catch (error) {
      console.error('Error in submitReport:', error);
      set({ isSubmitting: false });
      return { report_id: null, success: false, message: 'エラーが発生しました' };
    }
  },

  // Check if content has been reported by current user
  checkContentReported: async (contentType: string, contentId: string): Promise<ContentReportStatus> => {
    const { reportedContent } = get();
    const cacheKey = `${contentType}:${contentId}`;
    
    // Check cache first
    const cached = reportedContent.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) {
        return { is_reported: false, report_status: null, report_date: null };
      }

      const { data, error } = await supabase
        .rpc('check_content_reported', {
          user_id_param: currentUserId,
          content_type_param: contentType,
          content_id_param: contentId
        });

      if (error) {
        console.error('Error checking content reported:', error);
        return { is_reported: false, report_status: null, report_date: null };
      }

      const result = data?.[0] || { is_reported: false, report_status: null, report_date: null };
      
      // Cache the result
      const newReportedContent = new Map(reportedContent);
      newReportedContent.set(cacheKey, result);
      set({ reportedContent: newReportedContent });

      return result;
    } catch (error) {
      console.error('Error in checkContentReported:', error);
      return { is_reported: false, report_status: null, report_date: null };
    }
  },

  // Synchronous check using local cache
  isContentReportedSync: (contentType: string, contentId: string): boolean => {
    const { reportedContent } = get();
    const cacheKey = `${contentType}:${contentId}`;
    const cached = reportedContent.get(cacheKey);
    return cached?.is_reported || false;
  },

  // Clear report cache
  clearReportCache: () => {
    set({ reportedContent: new Map() });
  },

  // Refresh user reports (force reload)
  refreshUserReports: async (userId: string) => {
    await get().loadUserReports(userId, 20, 0);
  },
}));

// Helper hook for easier usage with UI feedback
export const useReporting = () => {
  const store = useReportingStore();
  
  return {
    ...store,
    
    // Convenience methods
    submitReportWithFeedback: async (params: Parameters<typeof store.submitReport>[0]) => {
      const result = await store.submitReport(params);
      
      if (result.success) {
        // You can add toast notification here
        console.log('Report submitted successfully:', result.message);
      } else {
        console.error('Failed to submit report:', result.message);
      }
      
      return result;
    },

    // Get categories by type for easier UI rendering
    getCategoriesByPriority: () => {
      const { reportCategories } = store;
      return {
        critical: reportCategories.filter(cat => 
          ['harassment', 'hate_speech', 'underage_user'].includes(cat.category_key)
        ),
        important: reportCategories.filter(cat => 
          ['inappropriate_content', 'privacy_violation', 'false_information'].includes(cat.category_key)
        ),
        standard: reportCategories.filter(cat => 
          ['spam', 'copyright_violation', 'impersonation', 'other'].includes(cat.category_key)
        )
      };
    },

    // Get user report statistics
    getReportStats: () => {
      const { userReports } = store;
      return {
        total: userReports.length,
        pending: userReports.filter(r => r.status === 'pending').length,
        resolved: userReports.filter(r => r.status === 'resolved').length,
        dismissed: userReports.filter(r => r.status === 'dismissed').length,
        recentReports: userReports.slice(0, 5), // Last 5 reports
      };
    },

    // Check if user can report (rate limiting)
    canSubmitReport: () => {
      const { userReports } = store;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Limit to 5 reports per hour
      const recentReports = userReports.filter(report => 
        new Date(report.created_at) > oneHourAgo
      );
      
      return {
        canReport: recentReports.length < 5,
        remainingReports: Math.max(0, 5 - recentReports.length),
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      };
    },
  };
};