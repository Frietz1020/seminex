import type { Profile } from '../../../api/client';
import { STUDENT_EMAIL_DOMAIN } from '../../../config';
import { blockLabel, programLabel, yearLevelLabel } from '../../../data/academic';
import { formatFullName } from '../../seminars/format';
import { AvatarUpload } from './AvatarUpload';

interface IdentityCardProps {
  profile: Profile;
  onAvatarUploaded: (avatarUrl: string) => void;
}

export function IdentityCard({ profile, onAvatarUploaded }: IdentityCardProps) {
  return (
    <section
      aria-labelledby="identity-name"
      className="relative flex flex-col items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-space-lg pt-space-xl text-center shadow-card"
    >
      <AvatarUpload profile={profile} onUploaded={onAvatarUploaded} />

      <h2 id="identity-name" className="mt-space-md font-headline-md text-headline-md leading-tight tracking-tight text-on-surface">
        {formatFullName(profile)}
      </h2>
      <p className="mt-space-sm inline-flex flex-wrap items-center justify-center gap-x-1 rounded-md bg-surface-container px-2.5 py-1 font-caption text-caption">
        <span className="font-semibold tracking-wider text-on-surface">{profile.studentId}</span>
        <span className="text-text-secondary">@{STUDENT_EMAIL_DOMAIN}</span>
      </p>
      <p className="mt-space-md w-full rounded-lg bg-surface-light px-3 py-2 font-body-sm text-body-sm text-text-secondary">
        {yearLevelLabel(profile.yearLevel)} · {programLabel(profile.program)} · {blockLabel(profile.block)}
      </p>

    </section>
  );
}
