import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

export interface ToastOptions {
  tone?: 'success' | 'error';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Longer than the export's 5 seconds, because the toast carries an undo action.
const DEFAULT_DURATION_MS = 8000;

interface ActiveToast extends ToastOptions {
  id: number;
}

/**
 * One toast at a time; a new one replaces the old. The timer pauses while the pointer is over the
 * toast or focus is inside it, so it never closes under "Undo registration" focus. Escape closes it.
 * There is no slide animation, so there is nothing to disable for reduced motion.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const counter = useRef(0);
  const timer = useRef({ id: 0, remaining: 0 });
  const toastRef = useRef<HTMLDivElement>(null);

  const paused = hovered || focused;
  const toastId = toast?.id ?? null;

  const dismissToast = useCallback(() => {
    // If focus is inside the toast, hand it back to the page instead of dropping it.
    if (toastRef.current?.contains(document.activeElement)) {
      document.getElementById('main')?.focus();
    }
    setToast(null);
    setHovered(false);
    setFocused(false);
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    timer.current = { id: counter.current, remaining: options.durationMs ?? DEFAULT_DURATION_MS };
    setToast({ ...options, id: counter.current });
  }, []);

  useEffect(() => {
    if (toastId === null || paused) return;
    const startedAt = Date.now();
    const timeout = window.setTimeout(() => {
      setToast((current) => (current && current.id === toastId ? null : current));
    }, timer.current.remaining);
    return () => {
      window.clearTimeout(timeout);
      if (timer.current.id === toastId) timer.current.remaining -= Date.now() - startedAt;
    };
  }, [toastId, paused]);

  useEffect(() => {
    if (toastId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) dismissToast();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toastId, dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-end lg:inset-x-auto lg:bottom-6 lg:right-6"
      >
        {toast && (
          <div
            ref={toastRef}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
            }}
            className="pointer-events-auto flex w-full max-w-96 flex-col rounded-xl bg-inverse-surface p-space-md text-inverse-on-surface shadow-overlay"
          >
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex items-start gap-space-sm">
                <Icon
                  name={toast.tone === 'error' ? 'info' : 'check_circle'}
                  size={22}
                  className={toast.tone === 'error' ? 'mt-0.5 text-secondary-fixed' : 'mt-0.5 text-tertiary-fixed'}
                />
                <div className="flex flex-col">
                  <span className="font-body-sm-medium text-body-sm-medium font-semibold text-white">
                    {toast.title}
                  </span>
                  {toast.message && (
                    <span className="line-clamp-2 font-caption text-caption text-surface-dim">{toast.message}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={dismissToast}
                className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-surface-dim hover:text-white"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {toast.actionLabel && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const action = toast.onAction;
                    dismissToast();
                    action?.();
                  }}
                  className="inline-flex min-h-11 items-center px-2 font-caption text-caption font-semibold text-secondary-fixed hover:underline"
                >
                  {toast.actionLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}