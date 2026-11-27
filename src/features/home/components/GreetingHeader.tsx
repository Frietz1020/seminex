import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/shell/PageHeader';
import { actionPrimary, actionSecondary } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { InlineError } from '../../../components/ui/StateMessage';
import { useProfile } from '../../../session/ProfileProvider';

export function GreetingHeader({ showActions = true }: { showActions?: boolean }) {
  const { state, reload } = useProfile();
  const profile = state.status === 'success' ? state.data : null;

  return (
    <PageHeader
      title={profile ? `Welcome back, ${profile.firstName}` : 'Welcome back'}
      subtitle={
        state.status === 'error' ? (
          <InlineError onRetry={reload}>Your profile could not be loaded.</InlineError>
        ) : undefined
      }
      actions={
        showActions ? (
          <>
            <Link to="/seminars" className={actionPrimary}>
              <span>Join seminar</span>
              <Icon name="arrow_forward" size={18} />
            </Link>
            <Link to="/my-seminars" className={actionSecondary}>
              <Icon name="event_available" size={18} className="text-text-secondary" />
              <span>View my seminars</span>
            </Link>
          </>
        ) : undefined
      }
    />
  );
}