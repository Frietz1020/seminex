import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type OrgIdentity, type Profile } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { PageHeader } from '../../../components/shell/PageHeader';
import { WorkspaceSwitcher } from '../../../components/shell/org/WorkspaceSwitcher';
import { Alert } from '../../../components/ui/Alert';
import { Avatar } from '../../../components/ui/Avatar';
import { cx } from '../../../components/ui/cx';
import { Dialog } from '../../../components/ui/Dialog';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { SelectField } from '../../../components/ui/SelectField';
import { Spinner } from '../../../components/ui/Spinner';
import { LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { TextField } from '../../../components/ui/TextField';
import { BLOCKS, PROGRAMS, YEAR_LEVELS, blockLabel, programLabel, yearLevelLabel } from '../../../data/academic';
import { useResource } from '../../../hooks/useResource';
import { useOrgIdentity } from '../../../session/OrgIdentityProvider';
import { expireSession } from '../../../session/storage';
import { sanitizeMiddleInitial } from '../../auth/validation';
import { AvatarUpload } from '../../profile/components/AvatarUpload';
import { ReadOnlyField } from '../../profile/components/ReadOnlyField';
import {
  PROFILE_FIELD_ORDER,
  toEditableProfile,
  toFormValues,
  validateProfile,
  validateProfileField,
  type ProfileFieldErrors,
  type ProfileFieldName,
  type ProfileFormValues,
} from '../../profile/profileValidation';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';

type FieldElement = HTMLInputElement | HTMLSelectElement | null;

function OrgIdentityCard({
  identity,
  studentProfile,
  onAvatarUploaded,
}: {
  identity: OrgIdentity;
  studentProfile: Profile | null;
  onAvatarUploaded: (avatarUrl: string) => void;
}) {
  return (
    <section
      aria-labelledby="org-identity-name"
      className="relative flex flex-col items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-space-lg pt-space-xl text-center"
    >
      {studentProfile ? (
        <AvatarUpload profile={studentProfile} onUploaded={onAvatarUploaded} />
      ) : (
        <Avatar src={identity.avatarUrl} firstName={identity.firstName} lastName={identity.lastName} size="xl" />
      )}

      <h2 id="org-identity-name" className="mt-space-md font-headline-md text-headline-md leading-tight text-on-surface">
        {identity.firstName} {identity.lastName}
      </h2>
      <p className="mt-space-sm inline-flex flex-wrap items-center justify-center gap-x-1 rounded-md bg-surface-container px-2.5 py-1 font-caption text-caption tabular-nums text-text-secondary">
        <span className="break-all font-semibold text-on-surface">{identity.email}</span>
      </p>
      <p className="mt-space-md w-full rounded-lg bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-text-secondary">
        {identity.position} · {identity.organization.name}
      </p>
    </section>
  );
}

function OrgProfileForm({
  identity,
  studentProfile,
  onSaved,
}: {
  identity: OrgIdentity;
  studentProfile: Profile | null;
  onSaved: (profile: Profile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProfileFormValues>(() =>
    studentProfile
      ? toFormValues(studentProfile)
      : { firstName: identity.firstName, lastName: identity.lastName, middleInitial: '', program: '', yearLevel: '', block: '' },
  );
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const editButtonRef = useRef<HTMLButtonElement>(null);
  const fieldRefs = useRef<Partial<Record<ProfileFieldName, FieldElement>>>({});
  const focusEditOnExit = useRef(false);

  useEffect(() => {
    if (editing) {
      fieldRefs.current.firstName?.focus();
    } else if (focusEditOnExit.current) {
      focusEditOnExit.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function setField(field: keyof ProfileFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (field !== 'middleInitial' && errors[field as ProfileFieldName]) {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  }

  function handleBlur(field: ProfileFieldName) {
    setErrors((previous) => ({ ...previous, [field]: validateProfileField(field, values) }));
  }

  function startEditing() {
    if (!studentProfile) return;
    setValues(toFormValues(studentProfile));
    setErrors({});
    setSaveError(null);
    setSavedMessage(false);
    setEditing(true);
  }

  function cancelEditing() {
    if (studentProfile) setValues(toFormValues(studentProfile));
    setErrors({});
    setSaveError(null);
    focusEditOnExit.current = true;
    setEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !studentProfile) return;

    const found = validateProfile(values);
    setErrors(found);
    const firstInvalid = PROFILE_FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    setSaving(true);
    setSaveError(null);
    const result = await api.updateProfile(toEditableProfile(values));
    setSaving(false);

    if (!result.ok) {
      if (result.error.code === 'session_expired') {
        expireSession();
        return;
      }
      setSaveError(`Your changes were not saved. ${errorText(result.error.code)}`);
      return;
    }
    onSaved(result.data);
    setSavedMessage(true);
    focusEditOnExit.current = true;
    setEditing(false);
  }

  const Group = editing ? 'div' : 'dl';
  const saved = studentProfile ? toFormValues(studentProfile) : null;

  return (
    <section
      aria-labelledby="org-information"
      className="rounded-xl border border-border-subtle bg-surface-card p-space-lg md:p-space-xl"
    >
      <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-center">
        <div className="flex flex-col gap-space-xs">
          <h2 id="org-information" className="font-headline-md text-headline-md text-on-surface">
            Organization information
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary">
            {studentProfile
              ? 'Review your locked organization appointment and update your personal details.'
              : 'Review your organization appointment and institutional record.'}
          </p>
        </div>
        {studentProfile && !editing && (
          <button ref={editButtonRef} type="button" onClick={startEditing} className={cx(actionTonal, 'shrink-0')}>
            <Icon name="edit" size={18} />
            <span>Edit profile</span>
          </button>
        )}
      </div>

      <div role="status" className="mt-space-md empty:hidden">
        {savedMessage && (
          <div className="flex items-start justify-between gap-space-sm rounded-lg bg-status-available-container p-space-md text-status-available">
            <div className="flex items-start gap-space-sm">
              <Icon name="check_circle" size={20} className="mt-0.5" />
              <span className="font-body-sm-medium text-body-sm-medium">Profile updated. Your changes are saved.</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setSavedMessage(false)}
              className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/60"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
      </div>

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="mt-space-lg flex flex-col gap-space-xl">
        {/* Locked Organization & Position section — cannot be edited */}
        <section
          aria-labelledby="appointment-record-heading"
          className="flex flex-col gap-space-md rounded-xl border border-border-subtle p-space-lg"
        >
          <div className="flex items-center gap-space-sm">
            <Icon name="badge" size={20} className="text-secondary" />
            <h3 id="appointment-record-heading" className="font-title-md text-title-md text-primary">
              Organization appointment
            </h3>
          </div>
          <p className="-mt-2 font-caption text-caption text-text-secondary">
            Organization and position come from your approved appointment and cannot be edited here.
          </p>
          <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <ReadOnlyField label="Organization" locked>
              {identity.organization.name}
            </ReadOnlyField>
            <ReadOnlyField label="Position" locked>
              {identity.position}
            </ReadOnlyField>
            <ReadOnlyField label="Institutional email" locked className="sm:col-span-2">
              {identity.email}
            </ReadOnlyField>
          </dl>
          {identity.membership?.appointmentLetterUrl && (
            <a
              href={identity.membership.appointmentLetterUrl}
              target="_blank"
              rel="noreferrer"
              className={`${actionTonal} w-fit`}
            >
              <Icon name="description" size={18} />
              View appointment letter
            </a>
          )}
        </section>

        {/* Personal & academic details (editable for student officers, read-only for advisers) */}
        <section
          aria-labelledby="org-personal-heading"
          className="flex flex-col gap-space-md rounded-xl border border-border-subtle p-space-lg"
        >
          <div className="flex items-center gap-space-sm">
            <Icon name="account_circle" size={20} className="text-secondary" />
            <h3 id="org-personal-heading" className="font-title-md text-title-md text-primary">
              {studentProfile ? 'Name and program' : 'Account details'}
            </h3>
          </div>

          {studentProfile && saved ? (
            <>
              <Group className="grid grid-cols-1 gap-space-md sm:grid-cols-5">
                {editing ? (
                  <div className="sm:col-span-2">
                    <TextField
                      ref={(element) => {
                        fieldRefs.current.firstName = element;
                      }}
                      id="org-profile-first-name"
                      label="First name"
                      required
                      autoComplete="given-name"
                      value={values.firstName}
                      error={errors.firstName}
                      readOnly={saving}
                      onChange={(value) => setField('firstName', value)}
                      onBlur={() => handleBlur('firstName')}
                    />
                  </div>
                ) : (
                  <ReadOnlyField label="First name" className="sm:col-span-2">
                    {saved.firstName}
                  </ReadOnlyField>
                )}
                {editing ? (
                  <div className="sm:col-span-2">
                    <TextField
                      ref={(element) => {
                        fieldRefs.current.lastName = element;
                      }}
                      id="org-profile-last-name"
                      label="Last name"
                      required
                      autoComplete="family-name"
                      value={values.lastName}
                      error={errors.lastName}
                      readOnly={saving}
                      onChange={(value) => setField('lastName', value)}
                      onBlur={() => handleBlur('lastName')}
                    />
                  </div>
                ) : (
                  <ReadOnlyField label="Last name" className="sm:col-span-2">
                    {saved.lastName}
                  </ReadOnlyField>
                )}
                {editing ? (
                  <div className="sm:col-span-1">
                    <TextField
                      id="org-profile-middle-initial"
                      label="M.I."
                      autoComplete="additional-name"
                      value={values.middleInitial}
                      readOnly={saving}
                      onChange={(value) => setField('middleInitial', sanitizeMiddleInitial(value))}
                    />
                  </div>
                ) : (
                  <ReadOnlyField label="M.I." className="sm:col-span-1">
                    {saved.middleInitial || 'None'}
                  </ReadOnlyField>
                )}
              </Group>

              <Group className="grid grid-cols-1 gap-space-md">
                {editing ? (
                  <SelectField
                    ref={(element) => {
                      fieldRefs.current.program = element;
                    }}
                    id="org-profile-program"
                    label="Program"
                    required
                    placeholder="Select your program"
                    options={PROGRAMS}
                    value={values.program}
                    error={errors.program}
                    disabled={saving}
                    onChange={(value) => setField('program', value)}
                    onBlur={() => handleBlur('program')}
                  />
                ) : (
                  <ReadOnlyField label="Program">{programLabel(studentProfile.program)}</ReadOnlyField>
                )}
              </Group>

              <Group className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                {editing ? (
                  <SelectField
                    ref={(element) => {
                      fieldRefs.current.yearLevel = element;
                    }}
                    id="org-profile-year-level"
                    label="Year level"
                    required
                    placeholder="Select year"
                    options={YEAR_LEVELS}
                    value={values.yearLevel}
                    error={errors.yearLevel}
                    disabled={saving}
                    onChange={(value) => setField('yearLevel', value)}
                    onBlur={() => handleBlur('yearLevel')}
                  />
                ) : (
                  <ReadOnlyField label="Year level">{yearLevelLabel(studentProfile.yearLevel)}</ReadOnlyField>
                )}
                {editing ? (
                  <SelectField
                    ref={(element) => {
                      fieldRefs.current.block = element;
                    }}
                    id="org-profile-block"
                    label="Block"
                    required
                    placeholder="Select block"
                    options={BLOCKS}
                    value={values.block}
                    error={errors.block}
                    disabled={saving}
                    onChange={(value) => setField('block', value)}
                    onBlur={() => handleBlur('block')}
                  />
                ) : (
                  <ReadOnlyField label="Block">{blockLabel(studentProfile.block)}</ReadOnlyField>
                )}
              </Group>
            </>
          ) : (
            <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
              <ReadOnlyField label="First name" locked>
                {identity.firstName}
              </ReadOnlyField>
              <ReadOnlyField label="Last name" locked>
                {identity.lastName}
              </ReadOnlyField>
            </dl>
          )}
        </section>

        {editing && (
          <div className="flex flex-col gap-space-md">
            {saveError && (
              <Alert variant="error" title="Changes not saved" icon="error">
                {saveError}
              </Alert>
            )}
            <div className="flex flex-col-reverse items-stretch justify-end gap-space-sm sm:flex-row sm:items-center">
              <button type="button" onClick={cancelEditing} className={actionTonal}>
                Cancel
              </button>
              <button
                type="submit"
                aria-disabled={saving || undefined}
                aria-busy={saving || undefined}
                className={cx(actionPrimary, saving && 'cursor-wait opacity-90')}
              >
                {saving ? <Spinner /> : <Icon name="check" size={18} />}
                <span>{saving ? 'Saving changes' : 'Save changes'}</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

export default function OrgProfilePage() {
  const { state, reload: reloadIdentity } = useOrgIdentity();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileOverride, setProfileOverride] = useState<Profile | null>(null);

  const isMember = state.status === 'success' && state.data.role === 'org_member';
  const profileResource = useResource(
    () => (isMember ? api.getProfile() : Promise.resolve({ ok: true as const, data: null as Profile | null })),
    isMember ? `org-member-profile-${state.data.accountId}` : 'org-adviser-no-student-profile',
  );
  const studentProfile =
    profileOverride ?? (profileResource.state.status === 'success' ? profileResource.state.data : null);

  useEffect(() => {
    document.title = 'Organization profile - Seminex';
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await api.signOut();
    setSigningOut(false);
    navigate('/organization/sign-in', { replace: true });
  }

  function handleProfileSaved(updated: Profile) {
    setProfileOverride(updated);
    reloadIdentity();
  }

  function handleAvatarUploaded(avatarUrl: string) {
    if (studentProfile) setProfileOverride({ ...studentProfile, avatarUrl });
    reloadIdentity();
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        subtitle="Manage your organization profile, workspace, and active session."
      />

      {state.status === 'loading' && (
        <LoadingRegion
          label="Loading your organization profile"
          className="grid grid-cols-1 gap-space-lg lg:grid-cols-[22rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-space-lg">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-[34rem] w-full rounded-xl" />
        </LoadingRegion>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-danger-soft bg-danger-surface p-space-lg text-danger-ink">
          Your organization profile could not be loaded. Please refresh and try again.
        </div>
      )}

      {state.status === 'empty' && (
        <div role="status" className="rounded-xl border border-border-subtle bg-surface-card p-space-xl">
          No organization profile is available for this account.
        </div>
      )}

      {state.status === 'success' && (
        <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-space-lg">
            <OrgIdentityCard
              identity={state.data}
              studentProfile={studentProfile}
              onAvatarUploaded={handleAvatarUploaded}
            />

            <section
              aria-labelledby="workspace-heading"
              className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg"
            >
              <div>
                <h2 id="workspace-heading" className="font-body-sm-medium text-body-sm-medium text-on-surface">
                  Active workspace
                </h2>
                <p className="font-caption text-caption text-text-secondary">
                  Your credentials stay the same when you switch portals.
                </p>
              </div>
              <WorkspaceSwitcher identity={state.data} variant="menu" />
            </section>

            <section
              aria-labelledby="org-sign-out-heading"
              className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <h2 id="org-sign-out-heading" className="font-body-sm-medium text-body-sm-medium text-on-surface">
                  End this session
                </h2>
                <p className="font-caption text-caption text-text-secondary">
                  Sign out of Seminex on this device.
                </p>
              </div>
              <button type="button" onClick={() => setConfirming(true)} className={cx(actionTonal, 'shrink-0')}>
                <Icon name="logout" size={18} />
                <span>Sign out</span>
              </button>
            </section>
          </div>

          <div>
            <OrgProfileForm
              identity={state.data}
              studentProfile={studentProfile}
              onSaved={handleProfileSaved}
            />
          </div>
        </div>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Sign out of Seminex?">
        <div className="mt-space-md flex flex-col gap-space-md">
          <p className="font-body-sm text-body-sm text-text-secondary">
            Signing out ends this organization session on this device.
          </p>
          <div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirming(false)} className={actionTonal}>
              Cancel
            </button>
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className={actionPrimary}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}
