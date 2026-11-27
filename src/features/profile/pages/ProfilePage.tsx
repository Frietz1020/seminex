import { useEffect } from 'react';
import { PageContainer } from '../../../components/shell/PageContainer';
import { PageHeader } from '../../../components/shell/PageHeader';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useProfile } from '../../../session/ProfileProvider';
import { ActivityCard } from '../components/ActivityCard';
import { IdentityCard } from '../components/IdentityCard';
import { ProfileForm } from '../components/ProfileForm';
import { SignOutCard } from '../components/SignOutCard';

export default function ProfilePage() {
  const { state, reload, replace } = useProfile();
  const profile = state.status === 'success' ? state.data : null;

  useEffect(() => {
    document.title = 'Profile - Seminex';
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        subtitle="Manage your student details, avatar, and active session."
      />

      {state.status === 'loading' && (
        <LoadingRegion label="Loading your profile" className="grid grid-cols-1 gap-space-lg lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-space-lg">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-[34rem] w-full rounded-xl" />
        </LoadingRegion>
      )}

      {state.status === 'error' && (
        <StateMessage
          role="alert"
          icon="info"
          title="Your profile could not be loaded"
          action={<RetryButton onClick={reload} />}
        >
          {errorText(state.code)}
        </StateMessage>
      )}

      {profile && (
        <>
          {state.status === 'success' && state.fromCache && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary"
            >
              <Icon name="info" size={18} />
              You are offline. Showing your saved profile. Connect to make changes.
            </p>
          )}

          <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-space-lg">
              <IdentityCard
                profile={profile}
                onAvatarUploaded={(avatarUrl) => replace({ ...profile, avatarUrl })}
              />
              <ActivityCard />
              <SignOutCard />
            </div>
            <div>
              <ProfileForm profile={profile} onSaved={replace} />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
