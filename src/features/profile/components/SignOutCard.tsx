import { useState } from 'react';
import { api } from '../../../api/client';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';

/**
 * Sign out asks first because it also removes the tickets saved on this device, and getting
 * them back needs a connection. Once confirmed, the API client clears the session and every
 * piece of offline data; the route guard then returns the student to Sign In.
 */
export function SignOutCard() {
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleConfirm() {
    if (signingOut) return;
    setSigningOut(true);
    await api.signOut();
    // The session is gone, so the route guard replaces this page. Nothing else to do here.
  }

  return (
    <section
      aria-labelledby="sign-out-heading"
      className="flex flex-col gap-space-md rounded-xl bg-surface-card p-space-lg shadow-card sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col">
        <h2 id="sign-out-heading" className="font-body-sm-medium text-body-sm-medium text-on-surface">
          End this session
        </h2>
        <p className="font-caption text-caption text-text-secondary">Sign out of Seminex on this device.</p>
      </div>
      <button type="button" onClick={() => setConfirming(true)} className={cx(actionTonal, 'shrink-0')}>
        <Icon name="logout" size={18} />
        <span>Sign out</span>
      </button>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Sign out of Seminex?">
        <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
          Tickets and drafts saved on this device are removed. You need an internet connection to sign in again and
          get your tickets back.
        </p>
        <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirming(false)} className={actionTonal}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            aria-disabled={signingOut || undefined}
            aria-busy={signingOut || undefined}
            className={cx(actionPrimary, signingOut && 'cursor-wait opacity-90')}
          >
            {signingOut && <Spinner />}
            <span>{signingOut ? 'Signing out' : 'Sign out'}</span>
          </button>
        </div>
      </Dialog>
    </section>
  );
}