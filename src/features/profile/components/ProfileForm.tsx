import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { api, type Profile } from '../../../api/client';
import { Alert } from '../../../components/ui/Alert';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { SelectField } from '../../../components/ui/SelectField';
import { Spinner } from '../../../components/ui/Spinner';
import { TextField } from '../../../components/ui/TextField';
import { STUDENT_EMAIL_DOMAIN } from '../../../config';
import { BLOCKS, PROGRAMS, YEAR_LEVELS, blockLabel, programLabel, yearLevelLabel } from '../../../data/academic';
import { expireSession } from '../../../session/storage';
import { sanitizeMiddleInitial } from '../../auth/validation';
import {
  PROFILE_FIELD_ORDER,
  toEditableProfile,
  toFormValues,
  validateProfile,
  validateProfileField,
  type ProfileFieldErrors,
  type ProfileFieldName,
  type ProfileFormValues,
} from '../profileValidation';
import { ReadOnlyField } from './ReadOnlyField';

interface ProfileFormProps {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}

type FieldElement = HTMLInputElement | HTMLSelectElement | null;

const ENROLLMENT_TEXT = { active: 'Active student', inactive: 'Not currently enrolled' } as const;

/**
 * Student information. View mode shows read-only values; "Edit profile" swaps in the same boxes
 * as inputs. Saving validates with the Sign Up rules and returns focus to "Edit profile".
 */
export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProfileFormValues>(() => toFormValues(profile));
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
    setValues(toFormValues(profile));
    setErrors({});
    setSaveError(null);
    setSavedMessage(false);
    setEditing(true);
  }

  function cancelEditing() {
    setValues(toFormValues(profile));
    setErrors({});
    setSaveError(null);
    focusEditOnExit.current = true;
    setEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

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

  const email = `${profile.studentId}@${STUDENT_EMAIL_DOMAIN}`;
  const Group = editing ? 'div' : 'dl';
  const saved = toFormValues(profile);

  return (
    <section aria-labelledby="student-information" className="rounded-xl bg-surface-card p-space-lg shadow-card md:p-space-xl">
      <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-center">
        <div className="flex flex-col gap-space-xs">
          <h2 id="student-information" className="font-headline-md text-headline-md tracking-tight text-on-surface">
            Student information
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary">
            Review your student record and update your name, program, year level, and block.
          </p>
        </div>
        {!editing && (
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
        <section aria-labelledby="record-heading" className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <Icon name="badge" size={20} className="text-secondary" />
            <h3 id="record-heading" className="font-title-md text-title-md tracking-tight text-primary">
              Enrollment record
            </h3>
          </div>
          <p className="-mt-2 font-caption text-caption text-text-secondary">
            These details come from your enrollment record and cannot be changed here.
          </p>
          <dl className="grid grid-cols-1 gap-space-md md:grid-cols-2">
            <ReadOnlyField label="Student ID" locked>
              <span className="font-medium">{profile.studentId}</span>
              <span className="text-text-secondary">@{STUDENT_EMAIL_DOMAIN}</span>
            </ReadOnlyField>
            <ReadOnlyField label="Enrollment status" locked>
              {ENROLLMENT_TEXT[profile.enrollmentStatus]}
            </ReadOnlyField>
            <ReadOnlyField label="Institutional email" locked>
              {email}
            </ReadOnlyField>
            <ReadOnlyField label="College" locked>
              {profile.college}
            </ReadOnlyField>
          </dl>
        </section>

        <section aria-labelledby="personal-heading" className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <Icon name="account_circle" size={20} className="text-secondary" />
            <h3 id="personal-heading" className="font-title-md text-title-md tracking-tight text-primary">
              Name and program
            </h3>
          </div>

          <Group className="grid grid-cols-1 gap-space-md sm:grid-cols-5">
            {editing ? (
              <div className="sm:col-span-2">
                <TextField
                  ref={(element) => {
                    fieldRefs.current.firstName = element;
                  }}
                  id="profile-first-name"
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
                  id="profile-last-name"
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
                  id="profile-middle-initial"
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
                id="profile-program"
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
              <ReadOnlyField label="Program">{programLabel(profile.program)}</ReadOnlyField>
            )}
          </Group>

          <Group className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            {editing ? (
              <SelectField
                ref={(element) => {
                  fieldRefs.current.yearLevel = element;
                }}
                id="profile-year-level"
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
              <ReadOnlyField label="Year level">{yearLevelLabel(profile.yearLevel)}</ReadOnlyField>
            )}
            {editing ? (
              <SelectField
                ref={(element) => {
                  fieldRefs.current.block = element;
                }}
                id="profile-block"
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
              <ReadOnlyField label="Block">{blockLabel(profile.block)}</ReadOnlyField>
            )}
          </Group>
        </section>

        {editing && (
          <div className="flex flex-col gap-space-md">
            {saveError && (
              <Alert variant="error" title="Changes not saved" icon={CircleAlert}>
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