import { useRef, useState } from 'react';
import { api, type Seminar } from '../../../api/client';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Dialog } from '../../../components/ui/Dialog';
import { errorText } from '../../../components/ui/errorText';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { expireSession } from '../../../session/storage';

interface CancelRegistrationDialogProps {
  /** The seminar to cancel. The dialog is open while this is set. */
  seminar: Seminar | null;
  onClose: () => void;
  onCancelled: (seminar: Seminar) => void;
}

/**
 * Confirms cancelling a registration. "Keep registration" has focus when it opens. The request
 * needs a connection and is not queued: without one, the dialog stays open with a message.
 */
export function CancelRegistrationDialog({ seminar, onClose, onCancelled }: CancelRegistrationDialogProps) {
  const online = useOnlineStatus();
  const keepRef = useRef<HTMLButtonElement>(null);
  const focusPageOnClose = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    if (!seminar || pending) return;
    if (!online) {
      setMessage('There is no connection. Connect to the internet, then select Cancel registration again.');
      return;
    }
    setMessage(null);
    setPending(true);
    const result = await api.cancelRegistration(seminar.id);
    setPending(false);

    if (result.ok) {
      // The card that opened this dialog is about to disappear, so focus goes to the page instead.
      focusPageOnClose.current = true;
      onCancelled(seminar);
      return;
    }
    if (result.error.code === 'session_expired') {
      expireSession();
      return;
    }
    setMessage(
      result.error.code === 'not_available'
        ? 'This registration can no longer be cancelled. You can cancel only before the seminar starts.'
        : errorText(result.error.code),
    );
  }

  function handleClose() {
    setMessage(null);
    setPending(false);
    if (focusPageOnClose.current) {
      focusPageOnClose.current = false;
      document.getElementById('main')?.focus();
    }
    onClose();
  }

  return (
    <Dialog open={seminar !== null} onClose={handleClose} title="Cancel your registration?" initialFocusRef={keepRef}>
      <p className="mt-space-sm font-body-sm-medium text-body-sm-medium text-primary">{seminar?.title}</p>
      <p className="mt-space-sm font-body-sm text-body-sm leading-relaxed text-text-secondary">
        Your seat will be released and your QR ticket will stop working. You can register again if seats remain.
      </p>

      {message && (
        <p
          role="alert"
          className="mt-space-md flex items-start gap-2 rounded-lg bg-error-container px-space-md py-space-sm font-body-sm text-body-sm text-on-error-container"
        >
          <Icon name="info" size={18} className="mt-0.5" />
          <span>{message}</span>
        </p>
      )}

      <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
        <button ref={keepRef} type="button" onClick={onClose} className={cx(actionTonal, 'px-4')}>
          Keep registration
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          aria-disabled={pending || undefined}
          className={cx(actionPrimary, 'px-4', pending && 'cursor-wait')}
        >
          {pending ? (
            <>
              <Spinner />
              <span>Cancelling...</span>
            </>
          ) : (
            'Cancel registration'
          )}
        </button>
      </div>
    </Dialog>
  );
}