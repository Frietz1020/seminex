import { Link } from 'react-router-dom';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';

interface SubmittedDialogProps {
  open: boolean;
  onClose: () => void;
  seminarId: string;
  seminarTitle: string;
  /** Shown only if the server returned one. */
  certificateSerial?: string;
}

/** Confirmation after submitting. Shows the issued certificate serial immediately when generated. */
export function SubmittedDialog({ open, onClose, seminarId, seminarTitle, certificateSerial }: SubmittedDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={certificateSerial ? 'Certificate issued' : 'Evaluation submitted'}>
      <div className="mt-space-md flex flex-col gap-space-lg text-center sm:text-left">
        <div className="flex flex-col items-center gap-space-md sm:flex-row sm:items-start">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-status-available-container text-status-available">
            <Icon name={certificateSerial ? 'workspace_premium' : 'check_circle'} size={26} />
          </span>
          <div className="flex flex-col gap-space-sm font-body-sm text-body-sm text-text-secondary">
            <p>Thank you. Your evaluation for {seminarTitle} was submitted.</p>
            {certificateSerial ? (
              <p>
                Your certificate is ready with serial{' '}
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-secondary">{certificateSerial}</span>.
              </p>
            ) : (
              <p>Your certificate will appear in History when it is ready.</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-space-sm sm:flex-row sm:justify-end">
          <Link to="/home" className={actionTonal}>
            Return to dashboard
          </Link>
          <Link to={`/history/${seminarId}`} className={actionPrimary}>
            <Icon name="workspace_premium" size={18} />
            <span>View certificate</span>
          </Link>
        </div>
      </div>
    </Dialog>
  );
}
