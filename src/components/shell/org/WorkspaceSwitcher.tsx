import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { OrgIdentity } from '../../../api/client';
import { BottomSheet } from '../../ui/BottomSheet';
import { Icon } from '../../ui/Icon';
import { cx } from '../../ui/cx';

type Workspace = 'organization' | 'participant';

interface WorkspaceSwitcherProps {
  identity: OrgIdentity | null;
  /** "menu" opens a dropdown above the button (desktop sidebar). "sheet" opens a bottom sheet (mobile). */
  variant: 'menu' | 'sheet';
}

const TARGETS: Record<Workspace, string> = { organization: '/org', participant: '/home' };

function Options({ current, onChoose, orgName }: { current: Workspace; onChoose: (workspace: Workspace) => void; orgName: string }) {
  const items: Array<{ id: Workspace; label: string; detail: string }> = [
    { id: 'organization', label: 'Organization', detail: orgName },
    { id: 'participant', label: 'Participant', detail: 'Student portal' },
  ];
  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitemradio"
          aria-checked={current === item.id}
          onClick={() => onChoose(item.id)}
          className={cx(
            'flex min-h-11 w-full items-center justify-between gap-space-sm rounded-lg px-space-sm py-2 text-left hover:bg-surface-container focus:bg-surface-container',
            current === item.id && 'bg-surface-container-low',
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className="font-body-sm-medium text-body-sm-medium text-on-surface">{item.label}</span>
            <span className="truncate font-caption text-caption text-text-secondary">{item.detail}</span>
          </span>
          {current === item.id && <Icon name="check" size={18} className="text-primary-container" />}
        </button>
      ))}
    </>
  );
}

/**
 * Switches between the Organization and Participant workspaces. Both use the same sign-in, so switching
 * only changes the page. An adviser has no participant workspace, so the control is a plain label.
 */
export function WorkspaceSwitcher({ identity, variant }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const current: Workspace = pathname.startsWith('/org') ? 'organization' : 'participant';
  const orgName = identity?.organization.name ?? '';
  const canSwitch = identity?.role === 'org_member';

  useEffect(() => {
    if (!open || variant !== 'menu') return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, variant]);

  function choose(workspace: Workspace) {
    setOpen(false);
    if (workspace !== current) navigate(TARGETS[workspace]);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  const label = (
    <span className="flex min-w-0 flex-col text-left">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">Workspace</span>
      <span className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">
        {current === 'organization' ? 'Organization' : 'Participant'}
      </span>
      {current === 'organization' && orgName && (
        <span className="truncate font-caption text-caption text-text-secondary">{orgName}</span>
      )}
    </span>
  );

  if (!canSwitch) {
    return (
      <div className="flex min-h-11 items-center rounded-xl bg-surface-card/80 p-space-sm shadow-card">{label}</div>
    );
  }

  const triggerClass =
    'flex min-h-11 w-full items-center justify-between gap-space-xs rounded-xl bg-surface-card/80 p-space-sm text-left shadow-card transition-colors hover:bg-surface-card';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={variant === 'menu' ? 'menu' : 'dialog'}
        aria-expanded={open}
        aria-controls={variant === 'menu' && open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
      >
        {label}
        <Icon name="unfold_more" size={20} className="text-on-surface-variant" />
      </button>

      {variant === 'menu' && open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Workspace"
          onKeyDown={handleMenuKeyDown}
          className="absolute inset-x-0 bottom-full z-50 mb-space-sm rounded-xl border border-border-subtle bg-surface-card p-1 shadow-overlay"
        >
          <Options current={current} onChoose={choose} orgName={orgName} />
        </div>
      )}

      {variant === 'sheet' && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Switch workspace">
          <div role="menu" aria-label="Workspace" className="mt-space-sm flex flex-col gap-1">
            <Options current={current} onChoose={choose} orgName={orgName} />
          </div>
        </BottomSheet>
      )}
    </div>
  );
}