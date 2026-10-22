import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Info, ShieldCheck, UsersRound, X } from 'lucide-react';
import { BrandPanel, MobileBrandHeader } from '../../../components/auth/BrandPanel';
import { useSession } from '../../../session/useSession';

function PortalCard({
  title,
  audience,
  description,
  children,
  to,
  onUnavailable,
}: {
  title: string;
  audience: string;
  description: string;
  children: ReactNode;
  to?: string;
  onUnavailable?: () => void;
}) {
  const className = 'group flex min-h-[112px] w-full items-center justify-between gap-4 rounded-xl bg-surface-card p-5 text-left shadow-card transition-all duration-200 hover:bg-surface-bright hover:shadow-card-hover focus-visible:outline-primary sm:min-h-[116px] sm:p-6';
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-colors duration-200 group-hover:bg-primary-container group-hover:text-on-primary sm:h-14 sm:w-14">
          {children}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-title-md text-title-md font-bold text-on-surface transition-colors group-hover:text-primary-container">{title}</span>
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{audience}</span>
          </span>
          <span className="mt-1 line-clamp-2 font-body-sm text-body-sm leading-snug text-on-surface-variant sm:font-body-base sm:text-body-base">{description}</span>
        </span>
      </div>
      <span className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-outline transition-all group-hover:translate-x-1 group-hover:bg-primary-container group-hover:text-on-primary">
        <ArrowRight aria-hidden="true" className="h-5 w-5" />
      </span>
    </>
  );

  if (to) return <Link to={to} className={className}>{content}</Link>;
  return <button type="button" onClick={onUnavailable} className={className}>{content}</button>;
}

export default function LandingPage() {
  const session = useSession();
  const [openPolicy, setOpenPolicy] = useState<'terms' | 'security' | null>(null);
  const policyDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.title = 'Welcome to Seminex - CCS Gordon College';
  }, []);

  useEffect(() => {
    const dialog = policyDialogRef.current;
    if (!dialog) return;
    if (openPolicy && !dialog.open) dialog.showModal();
    else if (!openPolicy && dialog.open) dialog.close();
  }, [openPolicy]);

  const participantPath = session ? '/home' : '/sign-in';

  return (
    <div className="min-h-dvh bg-background font-body-base text-on-surface antialiased">
      <main className="w-full bg-surface">
        <div className="flex min-h-dvh w-full flex-col md:flex-row">
          <BrandPanel
            message="Join seminars, show your ticket, and earn your certificate."
            supportingText="One place for Gordon College students to discover CCS seminars, track attendance, and complete evaluations."
          />

          <section className="flex flex-1 flex-col items-center justify-center bg-background px-5 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-12 xl:px-16">
            <div className="flex w-full max-w-[560px] flex-col">
              <div>
                <MobileBrandHeader />
                <h2 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Welcome to Seminex</h2>
                <p className="mt-2 font-body-lg text-body-lg text-on-surface-variant">Select your portal to continue.</p>
              </div>

              <div className="my-7 flex flex-col gap-4 sm:my-8">
                <PortalCard
                  title="Participant"
                  audience="Students"
                  description="Join seminars, show your ticket, and get your certificate."
                  to={participantPath}
                >
                  <BadgeCheck aria-hidden="true" className="h-7 w-7" />
                </PortalCard>
                <PortalCard
                  title="Organization"
                  audience="Officers & Leads"
                  description="Create and run seminars for your student organization."
                  to="/organization/sign-in"
                >
                  <UsersRound aria-hidden="true" className="h-7 w-7" />
                </PortalCard>
                <PortalCard
                  title="Admin"
                  audience="Faculty & Advisers"
                  description="Manage who belongs to your organization. For advisers and faculty."
                  to="/admin/sign-in"
                >
                  <ShieldCheck aria-hidden="true" className="h-7 w-7" />
                </PortalCard>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
                <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-outline" />
                <p className="font-body-sm text-body-sm leading-snug text-on-surface-variant">
                  First time using the portal? Verify your college account or student ID registration before entering.
                </p>
              </div>

              <div className="mt-8 border-t border-outline-variant pt-4">
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-caption text-caption text-on-surface-variant sm:justify-end">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-controls="landing-policy-dialog"
                    onClick={() => setOpenPolicy('terms')}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Terms of Use
                  </button>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-controls="landing-policy-dialog"
                    onClick={() => setOpenPolicy('security')}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Security Policy
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <dialog
        ref={policyDialogRef}
        id="landing-policy-dialog"
        aria-labelledby="landing-policy-title"
        onCancel={(event) => { event.preventDefault(); setOpenPolicy(null); }}
        onClose={() => setOpenPolicy(null)}
        onClick={(event) => { if (event.target === policyDialogRef.current) setOpenPolicy(null); }}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-card p-0 text-on-surface shadow-overlay backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-6 py-5">
          <div>
            <p className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary">Seminex · CCS Gordon College</p>
            <h2 id="landing-policy-title" className="mt-1 font-headline-md text-headline-md font-bold">
              {openPolicy === 'terms' ? 'Terms of Use' : 'Security Policy'}
            </h2>
          </div>
          <button type="button" autoFocus onClick={() => setOpenPolicy(null)} aria-label="Close policy dialog" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-on-surface-variant">
          {openPolicy === 'terms' ? (
            <>
              <p>Use Seminex to access Gordon College CCS seminar information, registrations, attendance records, and evaluations.</p>
              <p>Keep your account details accurate, use your own seminar ticket, and submit respectful, honest evaluations. Use only the portal features allowed by your assigned account and role.</p>
            </>
          ) : (
            <>
              <p>Keep your password private and do not share your sign-in or seminar ticket with others. Sign out when using a shared device.</p>
              <p>Only view or manage information allowed by your portal role. Report suspected account or data misuse to the College of Computer Studies.</p>
            </>
          )}
        </div>
        <div className="flex justify-end border-t border-outline-variant bg-surface-container-low px-6 py-4">
          <button type="button" onClick={() => setOpenPolicy(null)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 font-label-sm text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-primary">Close</button>
        </div>
      </dialog>
    </div>
  );
}
