import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
}

interface MenuProps {
  /** Accessible name for the button, for example "More options for <seminar title>". */
  label: string;
  items: readonly MenuItem[];
}

/**
 * Overflow menu button. Enter, Space, or an arrow key opens it and moves focus to an item. Arrow
 * keys, Home, and End move between items. Escape closes it and returns focus to the button, and
 * so do choosing an item and moving focus or the pointer outside.
 */
export function Menu({ label, items }: MenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<'first' | 'last'>('first');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (open) itemRefs.current[entry === 'last' ? items.length - 1 : 0]?.focus();
  }, [open, entry, items.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function openMenu(from: 'first' | 'last') {
    setEntry(from);
    setOpen(true);
  }

  function closeAndRestoreFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((element) => element === document.activeElement);
    let next = current;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      case 'ArrowDown':
        next = (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (current - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    itemRefs.current[next]?.focus();
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openMenu('first'))}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <Icon name="more_vert" size={22} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-20 mt-1 min-w-56 rounded-lg border border-border-subtle bg-surface-card p-1 shadow-overlay"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                // Focus goes back to the button first, so a dialog opened by the item returns focus there.
                closeAndRestoreFocus();
                item.onSelect();
              }}
              className="flex min-h-11 w-full items-center gap-space-sm rounded-md px-space-md text-left font-body-sm-medium text-body-sm-medium text-on-surface hover:bg-surface-container focus:bg-surface-container"
            >
              {item.icon && <Icon name={item.icon} size={18} className="text-text-subtle" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}