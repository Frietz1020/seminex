import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BadgeCheck, CircleHelp, Info, ShieldCheck, UsersRound } from 'lucide-react';
import { Icon } from '../../../components/ui/Icon';
import { BrandMark } from '../../../components/shell/BrandMark';
import { useNow } from '../../../hooks/useNow';
import { useSession } from '../../../session/useSession';
import { getAcademicPeriod } from '../../seminars/academicPeriod';

type Portal = 'organization' | 'admin';

function SeminexMark({ size = 'small' }: { size?: 'small' | 'large' }) {
  const large = size === 'large';
  return <BrandMark size={large ? 48 : 36} variant={large ? 'onDark' : 'default'} />;
}

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
  const now = useNow();
  const period = getAcademicPeriod(now);
  const session = useSession();
  const [unavailablePortal, setUnavailablePortal] = useState<Portal | null>(null);

  useEffect(() => {
    document.title = 'Welcome to Seminex - CCS Gordon College';
  }, []);

  const participantPath = session ? '/home' : '/sign-in';

  return (
    <div className="min-h-dvh bg-background font-body-base text-on-surface antialiased">
      <header className="fixed inset-x-0 top-0 z-50 h-16 bg-surface/90 shadow-shell backdrop-blur-xl">
        <div className="mx-auto flex h-full w-full items-center justify-between px-gutter-mobile sm:px-gutter lg:px-margin">
          <Link to="/" aria-label="Seminex landing page" className="flex min-h-11 items-center gap-space-sm rounded-lg">
            <SeminexMark />
            <span className="flex flex-col">
              <span className="font-title-md text-title-md font-semibold leading-none tracking-tight text-on-surface">Seminex CCS</span>
              <span className="mt-0.5 font-caption text-caption leading-none text-on-surface-variant">Gordon College Identity Gateway</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-space-sm py-1 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-outline" />
            <span className="hidden sm:inline">Institutional access</span>
            <span className="sm:hidden">Secure access</span>
          </span>
        </div>
      </header>

      <main className="w-full bg-surface pt-16">
        <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col lg:flex-row">
          <section className="relative flex flex-col justify-between overflow-hidden bg-primary-container p-7 text-on-primary shadow-overlay sm:p-10 lg:w-5/12 lg:p-12 xl:w-1/2 xl:p-16">
            <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary opacity-50 mix-blend-multiply blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-on-primary-container opacity-10 mix-blend-screen blur-2xl" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/30 via-transparent to-primary/80" />

            <div className="relative z-10 flex items-center gap-3">
              <SeminexMark size="large" />
              <span className="flex flex-col">
                <span className="font-headline-md text-headline-md font-bold leading-none tracking-tight text-on-primary">Seminex</span>
                <span className="mt-1 font-label-sm text-label-sm font-semibold tracking-widest text-on-primary-container">CCS GORDON COLLEGE</span>
              </span>
            </div>

            <div className="relative z-10 my-10 max-w-lg lg:my-12">
              <h1 className="font-headline-xl text-headline-xl-mobile font-bold leading-tight tracking-tight text-on-primary md:text-headline-xl">
                Join seminars, show your ticket, and earn your certificate.
              </h1>
              <p className="mt-6 font-body-lg text-body-lg leading-relaxed text-on-primary/80">
                One place for Gordon College students to discover CCS seminars, track attendance, and complete evaluations.
              </p>

              <div className="mt-8 flex items-center justify-between gap-4 rounded-xl bg-primary/40 p-4 backdrop-blur-md sm:mt-10 sm:p-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-on-primary/10 text-on-primary">
                    <Award aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-title-md text-title-md font-semibold leading-none text-on-primary">Verified attendance</span>
                    <span className="mt-1 font-caption text-caption text-on-primary/70">Certificates unlock when requirements are met</span>
                  </span>
                </div>
                <svg aria-hidden="true" className="hidden h-8 w-24 shrink-0 text-on-primary-container sm:block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 100 30">
                  <path d="M0 24 Q 25 28, 45 15 T 85 8 T 100 4" />
                </svg>
              </div>
            </div>

            <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-on-primary/15 pt-5 text-on-primary/75">
              <span className="flex flex-col">
                <span className="font-title-md text-title-md font-medium tracking-wide text-on-primary">College of Computer Studies Student Council</span>
                <span className="mt-0.5 font-caption text-caption text-on-primary/60">Olongapo City, Philippines · Academic Year {period.academicYear}</span>
              </span>
              <Icon name="workspace_premium" size={26} className="shrink-0 text-on-primary/40" />
            </footer>
          </section>

          <section className="flex flex-col items-center justify-center bg-background px-5 py-10 sm:px-10 sm:py-12 lg:w-7/12 lg:px-12 lg:py-12 xl:w-1/2 xl:px-16">
            <div className="flex w-full max-w-[560px] flex-col">
              <div>
                <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5 text-primary shadow-card">
                  <Icon name="school" size={16} />
                  <span className="font-label-sm text-label-sm font-semibold tracking-wider">SEMINEX · CCS GORDON COLLEGE</span>
                </span>
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
                  onUnavailable={() => setUnavailablePortal('organization')}
                >
                  <UsersRound aria-hidden="true" className="h-7 w-7" />
                </PortalCard>
                <PortalCard
                  title="Admin"
                  audience="Faculty & Advisers"
                  description="Manage who belongs to your organization. For advisers and faculty."
                  onUnavailable={() => setUnavailablePortal('admin')}
                >
                  <ShieldCheck aria-hidden="true" className="h-7 w-7" />
                </PortalCard>
              </div>

              {unavailablePortal && (
                <p role="status" className="-mt-3 mb-4 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
                  {unavailablePortal === 'organization' ? 'Organization' : 'Admin'} access is not available in the student portal yet.
                </p>
              )}

              <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
                <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-outline" />
                <p className="font-body-sm text-body-sm leading-snug text-on-surface-variant">
                  First time using the portal? Verify your college account or student ID registration before entering.
                </p>
              </div>

              <div className="mt-8 flex flex-col items-center justify-between gap-4 pt-2 font-body-sm text-body-sm text-on-surface-variant sm:flex-row">
                <Link to="/guidelines" className="group inline-flex min-h-11 items-center gap-1.5 font-semibold transition-colors hover:text-primary">
                  <CircleHelp aria-hidden="true" className="h-[18px] w-[18px] text-outline transition-colors group-hover:text-primary" />
                  Registration guidelines
                </Link>
                <span className="flex items-center gap-3 font-caption text-caption text-outline">
                  <span>Terms of Use</span>
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-outline" />
                  <span>Security Policy</span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
