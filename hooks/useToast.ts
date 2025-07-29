import { create } from 'zustand';
import { ToastType } from '@/components/Toast';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastData[];
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  
  showToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
  },
  
  hideToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  
  clearAllToasts: () => {
    set({ toasts: [] });
  },
}));

export const useToast = () => {
  const { showToast, hideToast, clearAllToasts } = useToastStore();
  
  return {
    // Helper methods for different toast types
    success: (title: string, message?: string, duration?: number) => {
      showToast({ type: 'success', title, message, duration });
    },
    
    error: (title: string, message?: string, duration?: number) => {
      showToast({ type: 'error', title, message, duration });
    },
    
    warning: (title: string, message?: string, duration?: number) => {
      showToast({ type: 'warning', title, message, duration });
    },
    
    info: (title: string, message?: string, duration?: number) => {
      showToast({ type: 'info', title, message, duration });
    },
    
    // Generic method
    show: showToast,
    
    // Management methods
    hide: hideToast,
    clearAll: clearAllToasts,
  };
};

// Hook to get all toasts for rendering
export const useToasts = () => {
  return useToastStore((state) => state.toasts);
};