/** Organization workspace actions follow the 48px, 12px-radius controls in the org component sheet. */
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-body-sm-medium text-body-sm-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60';

export const orgActionPrimary = `${base} bg-primary-container text-on-primary shadow-card hover:bg-maroon-dark`;
export const orgActionSecondary = `${base} border border-outline-variant/70 bg-surface-card text-on-surface shadow-card hover:bg-surface-container`;
export const orgActionTonal = `${base} bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high`;
export const orgActionDanger = `${base} bg-danger text-on-error shadow-card hover:bg-danger-ink`;

