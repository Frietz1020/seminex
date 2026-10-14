import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { cx } from './cx';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Visible status text, for example "Locked". Tabs are never disabled, so they stay focusable. */
  status?: string;
}

interface TabsProps {
  tabs: readonly TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  renderPanel: (selectedId: string) => ReactNode;
}

/** ARIA tabs pattern with automatic activation: arrow keys, Home, and End move and select. */
export function Tabs({ tabs, selectedId, onSelect, ariaLabel, renderPanel }: TabsProps) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.id === selectedId));

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = selectedIndex;
    switch (event.key) {
      case 'ArrowRight':
        next = (selectedIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (selectedIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSelect(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-space-sm overflow-x-auto"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={selected ? `${base}-panel` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={cx(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 font-body-sm-medium text-body-sm-medium transition-colors',
                selected
                  ? 'bg-primary-container text-on-primary shadow-card'
                  : 'text-text-secondary hover:bg-surface-container hover:text-on-surface',
              )}
            >
              {tab.icon && <Icon name={tab.icon} size={18} />}
              <span>{tab.label}</span>
              {tab.status && (
                <span
                  className={cx(
                    'rounded-sm px-1.5 py-0.5 font-caption text-caption',
                    selected ? 'bg-white/20 text-on-primary' : 'bg-surface-container-high text-text-secondary',
                  )}
                >
                  {tab.status}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${selectedId}`} tabIndex={0}>
        {renderPanel(selectedId)}
      </div>
    </div>
  );
}