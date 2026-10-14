import { useEffect } from 'react';
import { PageContainer } from '../../../components/shell/PageContainer';
import { AcademicYearPill } from '../../../components/ui/AcademicYearPill';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useProfile } from '../../../session/ProfileProvider';
import { getAcademicPeriod } from '../../seminars/academicPeriod';
import { ActivityCard } from '../components/ActivityCard';
import { IdentityCard } from '../components/IdentityCard';
import { ProfileForm } from '../components/ProfileForm';
import { SignOutCard } from '../components/SignOutCard';

export default function ProfilePage() {
  const now = useNow();
  const { state, reload, replace } = useProfile();
  const period = getAcademicPeriod(now);
  const profile = state.status === 'success' ? state.data : null;

  useEffect(() => {
    document.title = 'Profile - Seminex';
  }, []);

  return (
    <PageContainer>
      <header className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
        <div className="flex flex-col gap-space-xs">
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Student portal</p>
          <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">
            Profile
          </h1>
          <p className="font-body-base text-body-base text-text-secondary">
            Manage your student record, academic activity, and account.
          </p>
        </div>
        <div className="self-start md:self-auto">
          <AcademicYearPill academicYear={period.academicYear} />
        </div>
      </header>

      {state.status === 'loading' && (
        <LoadingRegion label="Loading your profile" className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
          <div className="flex flex-col gap-space-lg lg:col-span-4">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-[34rem] w-full rounded-xl lg:col-span-8" />
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

          <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
            <div className="flex flex-col gap-space-lg lg:col-span-4 lg:row-start-1">
              <IdentityCard
                profile={profile}
                onAvatarUploaded={(avatarUrl) => replace({ ...profile, avatarUrl })}
              />
              <ActivityCard academicYear={period.academicYear} />
            </div>
            <div className="lg:col-span-8 lg:row-span-2 lg:row-start-1">
              <ProfileForm profile={profile} onSaved={replace} />
            </div>
            <div className="lg:col-span-4 lg:row-start-2">
              <SignOutCard />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}