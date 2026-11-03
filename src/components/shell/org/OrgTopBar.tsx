import { Link } from 'react-router-dom';
import type { OrgIdentity } from '../../../api/client';
import type { ResourceState } from '../../../hooks/useResource';
import { Avatar } from '../../ui/Avatar';
import { BrandMark } from '../BrandMark';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/**
 * Desktop: name with Student ID and position, then avatar. Below lg there is no sidebar, so
 * the logo and the workspace button sit on the left. There is no notification bell: notifications are on hold.
 */
export function OrgTopBar({ state }: { state: ResourceState<OrgIdentity> }) {
  const identity = state.status === 'success' ? state.data : null;

  const detail = identity
    ? [identity.studentId, identity.position].filter(Boolean).join(' \u00b7 ')
    : '';

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-space-sm bg-surface-light/90 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] shadow-shell backdrop-blur-xl lg:left-64 lg:h-16 lg:pl-space-xl lg:pr-space-xl lg:pt-0">
      <div className="flex min-w-0 items-center gap-space-md">
        <Link to="/org" aria-label="Seminex organization home" className="flex min-h-11 items-center rounded-lg lg:hidden">
          <BrandMark />
        </Link>
        <div className="min-w-0 lg:hidden">
          <WorkspaceSwitcher identity={identity} variant="sheet" />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-space-sm" aria-busy={state.status === 'loading'}>
        <div className="hidden flex-col text-right sm:flex">
          {identity ? (
            <>
              <span className="font-body-sm-medium text-body-sm-medium leading-tight text-on-surface">
                {identity.firstName} {identity.lastName}
              </span>
              <span className="font-caption text-caption text-text-subtle">{detail}</span>
            </>
          ) : state.status === 'loading' ? (
            <span aria-hidden="true" className="flex flex-col items-end gap-1">
              <span className="h-3.5 w-28 rounded bg-surface-container-high motion-safe:animate-pulse" />
              <span className="h-3 w-20 rounded bg-surface-container-high motion-safe:animate-pulse" />
            </span>
          ) : null}
        </div>
        {identity && <span className="sr-only sm:hidden">{`${identity.firstName} ${identity.lastName}`}</span>}
        <Avatar src={identity?.avatarUrl} firstName={identity?.firstName ?? ''} lastName={identity?.lastName ?? ''} size="sm" />
      </div>
    </header>
  );
}
