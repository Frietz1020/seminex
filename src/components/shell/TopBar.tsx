import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '../../session/ProfileProvider';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { formatStudentLine } from '../../features/seminars/format';
import { BrandMark } from './BrandMark';

/**
 * Desktop: search, bell, name with student number and program, avatar (the logo lives only in the
 * sidebar). Below lg, where there is no sidebar: logo, bell, avatar, and the name block from sm up.
 */
export function TopBar() {
  const navigate = useNavigate();
  const { state } = useProfile();
  const [query, setQuery] = useState('');

  const profile = state.status === 'success' ? state.data : null;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : '';
  const unread = profile?.unreadNotificationCount ?? 0;
  const bellLabel = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/seminars?q=${encodeURIComponent(trimmed)}` : '/seminars');
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between bg-surface-light/90 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] shadow-shell backdrop-blur-xl lg:left-64 lg:h-16 lg:pl-space-xl lg:pr-space-xl lg:pt-0">
      <div className="flex items-center gap-space-md">
        <Link to="/home" aria-label="Seminex home" className="flex min-h-11 items-center rounded-lg lg:hidden">
          <BrandMark />
        </Link>
        <form role="search" onSubmit={handleSearch} className="relative hidden w-80 lg:block">
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <input
            type="search"
            aria-label="Search seminars"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search seminars, topics, speakers"
            className="h-11 w-full rounded-lg border border-charcoal-300 bg-surface-card pl-10 pr-4 font-body-sm text-body-sm text-on-surface outline-none transition-all placeholder:text-text-subtle focus:border-primary-container focus:ring-2 focus:ring-primary-container/30"
          />
        </form>
      </div>

      <div className="flex items-center gap-space-md lg:gap-space-lg">
        <Link
          to="/notifications"
          aria-label={bellLabel}
          className="relative flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <Icon name="notifications" size={22} />
          {unread > 0 && (
            <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary-container" />
          )}
        </Link>

        <div className="flex items-center gap-space-sm">
          <div className="hidden flex-col text-right sm:flex" aria-busy={state.status === 'loading'}>
            {profile ? (
              <>
                <span className="font-body-sm-medium text-body-sm-medium leading-tight text-on-surface">
                  {fullName}
                </span>
                <span className="font-caption text-caption text-text-subtle">{formatStudentLine(profile)}</span>
              </>
            ) : state.status === 'loading' ? (
              <span aria-hidden="true" className="flex flex-col items-end gap-1">
                <span className="h-3.5 w-28 rounded bg-surface-container-high motion-safe:animate-pulse" />
                <span className="h-3 w-20 rounded bg-surface-container-high motion-safe:animate-pulse" />
              </span>
            ) : null}
          </div>
          <span className="sr-only sm:hidden">{fullName}</span>
          <Avatar
            src={profile?.avatarUrl}
            firstName={profile?.firstName ?? ''}
            lastName={profile?.lastName ?? ''}
            size="sm"
          />
        </div>
      </div>
    </header>
  );
}
