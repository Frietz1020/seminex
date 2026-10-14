import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: string;
  children: ReactNode;
  className?: string;
  /** Element to focus when the dialog opens. Without it, the first focusable element (Close) gets focus. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Modal built on the native <dialog>: the page behind it is inert, Escape closes it, and focus
 * returns to the element that opened it. Body scroll is locked while it is open.
 */
export function Dialog({ open, onClose, title, children, className, initialFocusRef }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // Only the open state should re-run this; the ref object is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function handleClose() {
    openerRef.current?.focus();
    openerRef.current = null;
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) ref.current?.close();
      }}
      className={cx(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-surface-card p-0 text-on-surface shadow-overlay backdrop:bg-inverse-surface/60 backdrop:backdrop-blur-sm',
        className,
      )}
    >
      {open && (
        <div className="relative p-space-xl">
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="close" size={24} />
          </button>
          <h2 id={titleId} className="pr-10 font-title-md text-title-md text-on-surface">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}