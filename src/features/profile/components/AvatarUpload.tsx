import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { api, type Profile } from '../../../api/client';
import { actionTonal } from '../../../components/ui/actionStyles';
import { Avatar } from '../../../components/ui/Avatar';
import { cx } from '../../../components/ui/cx';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { useToast } from '../../../components/ui/Toast';
import { AVATAR_HINT, AVATAR_TYPES } from '../../../config';
import { expireSession } from '../../../session/storage';
import { validateAvatarFile } from '../avatarFile';

interface AvatarUploadProps {
  profile: Profile;
  onUploaded: (avatarUrl: string) => void;
}

/**
 * Avatar with a real button that opens the file picker. The file is checked before anything is
 * sent, previewed through an object URL while it uploads, and the URL is revoked afterward.
 */
export function AvatarUpload({ profile, onUploaded }: AvatarUploadProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Lets the same file be chosen again after a failure.
    if (!file || uploading) return;

    const problem = validateAvatarFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    clearPreview();
    previewRef.current = URL.createObjectURL(file);
    setPreview(previewRef.current);
    setUploading(true);

    const result = await api.uploadAvatar(file);
    setUploading(false);
    clearPreview();

    if (!result.ok) {
      if (result.error.code === 'session_expired') {
        expireSession();
        return;
      }
      setError(`Your photo was not uploaded. ${errorText(result.error.code)}`);
      return;
    }
    onUploaded(result.data.avatarUrl);
    showToast({ title: 'Photo updated', message: 'Your new profile photo is saved.' });
  }

  return (
    <div className="flex flex-col items-center gap-space-xs">
      <div className="relative">
        <Avatar
          src={preview ?? profile.avatarUrl}
          firstName={profile.firstName}
          lastName={profile.lastName}
          size="xl"
          alt={preview || profile.avatarUrl ? 'Your profile photo' : ''}
          className={cx(uploading && 'opacity-60')}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={AVATAR_TYPES.join(',')}
        onChange={(event) => void handleChange(event)}
      />
      <button
        type="button"
        onClick={() => {
          if (!uploading) inputRef.current?.click();
        }}
        aria-disabled={uploading || undefined}
        aria-busy={uploading || undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className={cx(actionTonal, 'mt-space-xs', uploading && 'cursor-wait')}
      >
        {uploading ? <Spinner /> : <Icon name="photo_camera" size={18} />}
        <span>{uploading ? 'Uploading photo' : 'Upload new photo'}</span>
      </button>
      <p id={hintId} className="font-caption text-caption text-text-subtle">
        {AVATAR_HINT}
      </p>
      <div role="alert" id={errorId} className="max-w-xs text-center">
        {error && <p className="font-body-sm-medium text-body-sm-medium text-error">{error}</p>}
      </div>
    </div>
  );
}