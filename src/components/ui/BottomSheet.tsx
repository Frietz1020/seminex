import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the sheet's accessible name. */
  title: string;
  children: ReactNode;
}

/**
 * Modal sheet anchored to the bottom edge, for small screens. Built on the native <dialog>, so the page
 * behind is inert, Escape closes it, and focus returns to the opener. Respects the bottom safe area.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
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
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-b-none rounded-t-xl bg-surface-card p-0 text-on-surface shadow-overlay backdrop:bg-inverse-surface/60"
    >
      {open && (
        <div className="px-space-md pb-[calc(1rem+env(safe-area-inset-bottom))] pt-space-sm">
          <div aria-hidden="true" className="mx-auto mb-space-sm h-1 w-12 rounded-full bg-on-surface-variant/30" />
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="font-title-md text-title-md text-on-surface">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => ref.current?.close()}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle hover:bg-surface-container"
            >
              <Icon name="close" size={24} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}