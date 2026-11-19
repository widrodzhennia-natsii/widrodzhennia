import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (accepted: boolean) => void;
}

interface FeedbackState {
  toasts: ToastItem[];
  confirmRequest: ConfirmRequest | null;
  notify: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
  confirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  resolveConfirm: (accepted: boolean) => void;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toasts: [],
  confirmRequest: null,

  notify: (message: string, type: ToastType = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, type, message }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmRequest: {
          ...options,
          resolve,
        },
      });
    });
  },

  resolveConfirm: (accepted: boolean) => {
    const req = get().confirmRequest;
    if (req) {
      req.resolve(accepted);
    }
    set({ confirmRequest: null });
  },
}));
