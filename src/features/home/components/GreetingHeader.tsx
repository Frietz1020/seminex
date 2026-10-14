import { Link } from 'react-router-dom';
import { actionPrimary, actionSecondary } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { useProfile } from '../../../session/ProfileProvider';
import { formatAcademicLine } from '../../seminars/format';

export function GreetingHeader() {
  const { state, reload } = useProfile();
  const profile = state.status === 'success' ? state.data : null;

  return (
    <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-space-xs">
        <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-on-surface md:text-headline-xl">
          {profile ? `Welcome back, ${profile.firstName}` : 'Welcome back'}
        </h1>
        {profile ? (
          <p className="font-body-base text-body-base text-text-secondary">{formatAcademicLine(profile)}</p>
        ) : state.status === 'loading' ? (
          <LoadingRegion label="Loading your profile">
            <Skeleton className="h-6 w-80 max-w-full" />
          </LoadingRegion>
        ) : (
          <InlineError onRetry={reload}>Your profile could not be loaded.</InlineError>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-space-sm">
        <Link to="/seminars" className={actionPrimary}>
          <span>Join seminar</span>
          <Icon name="arrow_forward" size={18} />
        </Link>
        <Link to="/my-seminars" className={actionSecondary}>
          <Icon name="event_available" size={18} className="text-text-secondary" />
          <span>View my seminars</span>
        </Link>
      </div>
    </div>
  );
}