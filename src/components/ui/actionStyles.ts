// Class strings for dashboard actions rendered as links or buttons. 44px minimum height.
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 font-body-sm-medium text-body-sm-medium transition-colors';

export const actionPrimary = `${base} bg-primary-container text-on-primary shadow-card hover:bg-maroon-dark`;
export const actionSecondary = `${base} bg-surface-card text-on-surface shadow-card hover:bg-surface-container`;
export const actionTonal = `${base} bg-surface-container text-on-surface hover:bg-surface-container-high`;
export const actionDisabled = `${base} cursor-not-allowed bg-surface-container-high text-text-secondary`;